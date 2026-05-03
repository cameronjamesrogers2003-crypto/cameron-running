import { inngest } from "@/lib/inngest";
import prisma from "@/lib/db";
import { fetchFullActivity } from "@/lib/strava";
import { fetchWeatherAtTime } from "@/lib/weather/openMeteo";
import { computeRunRating, type ScoreInput, type SessionType } from "@/lib/scoring/index";
import { determineTier, type AdaptationContext } from "@/lib/adaptation/ruleEngine";
import { buildTier1Patch, buildTier2Patch } from "@/lib/adaptation/patchBuilder";
import { generateAdaptivePatch, type Tier3Input } from "@/lib/llm/adaptPatch";
import { generateCommentary } from "@/lib/llm/commentary";
import { computeACWR } from "@/lib/scoring/rTSS";
import type { GuardrailContext, SessionPatch } from "@/lib/adaptation/guardrails";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const processActivityJob = inngest.createFunction(
  {
    id: "process-strava-activity",
    triggers: [{ event: "strava/activity.created" }],
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async (ctx: any) => {
    const { event, step } = ctx as {
      event: { data: { activityId: string } };
      step: { run: <T>(id: string, fn: () => Promise<T>) => Promise<T> };
    };
    const { activityId } = event.data;

    // Step 1: Fetch full Strava activity (with splits) and upsert into DB
    const activity = await step.run("fetch-and-save-activity", async () => {
      const full = await fetchFullActivity(activityId);
      if (!full) throw new Error(`Failed to fetch Strava activity ${activityId}`);

      const avgPaceSecKm = full.average_speed > 0 ? Math.round(1000 / full.average_speed) : 0;
      const splits = full.splits_metric?.map(s => ({
        distance: s.distance,
        movingTime: s.moving_time,
        avgSpeed: s.average_speed,
        gradeAdjSpeed: s.average_grade_adjusted_speed,
        avgHR: s.average_heartrate,
      })) ?? null;

      const sportType = full.sport_type ?? full.type ?? "Run";
      const activityType = (sportType === "Run" || sportType === "VirtualRun")
        ? "running"
        : sportType === "TrailRun" ? "trail_running"
        : sportType.toLowerCase();

      await prisma.activity.upsert({
        where: { id: activityId },
        create: {
          id: activityId,
          date: new Date(full.start_date),
          distanceKm: full.distance / 1000,
          durationSecs: full.moving_time,
          avgPaceSecKm,
          avgHeartRate: full.average_heartrate ? Math.round(full.average_heartrate) : null,
          maxHeartRate: full.max_heartrate ? Math.round(full.max_heartrate) : null,
          calories: full.calories ? Math.round(full.calories) : null,
          activityType,
          elapsedTimeSecs: full.elapsed_time,
          elevationGainM: full.total_elevation_gain ?? null,
          startLat: full.start_latlng?.[0] ?? null,
          startLon: full.start_latlng?.[1] ?? null,
          manual: full.manual ?? false,
          splits: splits ?? undefined,
        },
        update: {
          distanceKm: full.distance / 1000,
          durationSecs: full.moving_time,
          avgPaceSecKm,
          avgHeartRate: full.average_heartrate ? Math.round(full.average_heartrate) : null,
          maxHeartRate: full.max_heartrate ? Math.round(full.max_heartrate) : null,
          elapsedTimeSecs: full.elapsed_time,
          elevationGainM: full.total_elevation_gain ?? null,
          startLat: full.start_latlng?.[0] ?? null,
          startLon: full.start_latlng?.[1] ?? null,
          manual: full.manual ?? false,
          splits: splits ?? undefined,
        },
      });

      // Return a plain serializable object (Decimal fields avoided here)
      return {
        id: activityId,
        date: new Date(full.start_date).toISOString(),
        distanceKm: full.distance / 1000,
        durationSecs: full.moving_time,
        elapsedTimeSecs: full.elapsed_time,
        avgPaceSecKm,
        avgHeartRate: full.average_heartrate ? Math.round(full.average_heartrate) : null,
        maxHeartRate: full.max_heartrate ? Math.round(full.max_heartrate) : null,
        elevationGainM: full.total_elevation_gain ?? null,
        startLat: full.start_latlng?.[0] ?? null,
        startLon: full.start_latlng?.[1] ?? null,
        activityType,
        splits,
      };
    });

    if (!["running", "trail_running"].includes(activity.activityType)) {
      return { skipped: true, reason: "not_a_run" };
    }

    // Step 2: Match to a ScheduledSession on the same calendar date
    const scheduled = await step.run("match-scheduled-session", async () => {
      const actDate = new Date(activity.date);
      actDate.setHours(0, 0, 0, 0);
      const nextDay = new Date(actDate);
      nextDay.setDate(nextDay.getDate() + 1);

      const session = await prisma.scheduledSession.findFirst({
        where: {
          date: { gte: actDate, lt: nextDay },
          activityId: null,
          status: "SCHEDULED",
        },
      });

      if (session) {
        await prisma.scheduledSession.update({
          where: { id: session.id },
          data: { activityId, status: "COMPLETED" },
        });
        return {
          id: session.id,
          planId: session.planId,
          sessionType: session.sessionType as string,
          currentDistanceKm: Number(session.currentDistanceKm),
          originalDistanceKm: Number(session.originalDistanceKm),
          targetPaceMinKmLow: session.targetPaceMinKmLow ? Number(session.targetPaceMinKmLow) : null,
          targetPaceMinKmHigh: session.targetPaceMinKmHigh
            ? Number(session.targetPaceMinKmHigh) : null,
          targetHrZone: session.targetHrZone,
        };
      }
      return null;
    });

    // Step 3: Fetch weather at run start location + time
    const weather = await step.run("fetch-weather", async () => {
      if (!activity.startLat || !activity.startLon) return null;
      return fetchWeatherAtTime(activity.startLat, activity.startLon, new Date(activity.date));
    });

    // Step 4: Compute run rating (pure function, no I/O)
    const ratingResult = await step.run("compute-rating", async () => {
      const [profile, recentRatings] = await Promise.all([
        prisma.profile.findUnique({ where: { id: 1 } }),
        prisma.runRating.findMany({
          orderBy: { createdAt: "desc" },
          take: 28,
          select: { score: true, rTSS: true, createdAt: true },
        }),
      ]);

      const ageYears = profile?.dateOfBirth
        ? Math.floor((Date.now() - new Date(profile.dateOfBirth).getTime()) / (365.25 * 86400000))
        : 22;

      const sessionType: SessionType = (scheduled?.sessionType as SessionType) ?? "EASY";
      const plannedKm = scheduled?.currentDistanceKm ?? activity.distanceKm;

      const recentTSS = recentRatings
        .filter(r => r.rTSS !== null)
        .map(r => ({ date: r.createdAt, tss: Number(r.rTSS) }));

      const recent4wkAvgScore = recentRatings.length > 0
        ? recentRatings.reduce((s, r) => s + Number(r.score), 0) / recentRatings.length
        : null;

      const input: ScoreInput = {
        activityId: activity.id,
        sessionType,
        plannedKm,
        actualKm: activity.distanceKm,
        durationSecs: activity.durationSecs,
        elapsedSecs: activity.elapsedTimeSecs ?? activity.durationSecs,
        avgPaceSecKm: activity.avgPaceSecKm,
        avgHR: activity.avgHeartRate,
        maxHR: activity.maxHeartRate,
        elevationGainM: activity.elevationGainM,
        splits: activity.splits as ScoreInput["splits"],
        targetPaceLowSecKm: scheduled?.targetPaceMinKmLow
          ? scheduled.targetPaceMinKmLow * 60 : null,
        targetPaceHighSecKm: scheduled?.targetPaceMinKmHigh
          ? scheduled.targetPaceMinKmHigh * 60 : null,
        targetHrZone: scheduled?.targetHrZone ?? null,
        ageYears,
        rftpSecKm: profile?.rftpSecPerKm ?? null,
        hrMax: profile?.hrMax ?? null,
        weatherTempC: weather?.tempC ?? null,
        weatherDewPointC: weather?.dewPointC ?? null,
        recentTSS,
        recent4wkAvgScore,
      };

      return computeRunRating(input);
    });

    // Step 5: Persist RunRating (skip if already rated)
    const savedRatingId = await step.run("save-rating", async () => {
      const existing = await prisma.runRating.findUnique({ where: { activityId } });
      if (existing) return existing.id;

      const created = await prisma.runRating.create({
        data: {
          activityId,
          scheduledId: scheduled?.id ?? null,
          score: ratingResult.score,
          distanceScore: ratingResult.distanceScore,
          paceScore: ratingResult.paceScore,
          hrScore: ratingResult.hrScore ?? 0,
          executionScore: ratingResult.executionScore,
          rTSS: ratingResult.rTSS,
          intensityFactor: ratingResult.intensityFactor,
          decouplingPct: ratingResult.decouplingPct,
          gapMinKm: ratingResult.gapSecKm ? ratingResult.gapSecKm / 60 : null,
          weatherTempC: ratingResult.weatherTempC,
          weatherDewPointC: ratingResult.weatherDewPointC,
          heatAdjusted: ratingResult.heatAdjusted,
          algorithmVersion: ratingResult.algorithmVersion,
        },
      });
      return created.id;
    });

    // Step 6: Run adaptation engine (only if matched to a plan session)
    if (scheduled) {
      await step.run("run-adaptation", async () => {
        const [plan, recentRatings] = await Promise.all([
          prisma.trainingPlan.findUnique({
            where: { id: scheduled.planId },
            include: {
              sessions: {
                where: { date: { gte: new Date() }, status: "SCHEDULED" },
                orderBy: { date: "asc" },
                take: 6,
              },
            },
          }),
          prisma.runRating.findMany({
            orderBy: { createdAt: "desc" },
            take: 7,
            select: { score: true, rTSS: true, createdAt: true },
          }),
        ]);

        if (!plan) return;

        const scores = recentRatings.map(r => Number(r.score));
        const recentTSS = recentRatings
          .filter(r => r.rTSS !== null)
          .map(r => ({ date: r.createdAt, tss: Number(r.rTSS) }));

        const { acwr, atl, ctl } = computeACWR(recentTSS);
        const lastScore = scores[0] ?? null;
        const last3 = scores.slice(0, 3);
        const last3Avg = last3.length > 0
          ? last3.reduce((a, b) => a + b, 0) / last3.length : null;

        const prevRun = recentRatings[1];
        const daysSinceLastRun = prevRun
          ? Math.floor((Date.now() - new Date(prevRun.createdAt).getTime()) / 86400000)
          : 999;

        const planStart = new Date(plan.startDate);
        const totalWeeks = Math.max(1, Math.ceil(
          (new Date(plan.raceDate).getTime() - planStart.getTime()) / (7 * 86400000)
        ));
        const currentWeek = Math.max(1, Math.ceil(
          (Date.now() - planStart.getTime()) / (7 * 86400000)
        ));
        const isInTaper = currentWeek > totalWeeks - 3;

        const recentAdjustments = await prisma.planAdjustment.findMany({
          where: { planId: plan.id },
          orderBy: { triggeredAt: "desc" },
          take: 10,
        });

        const tier2FiredAt = recentAdjustments.find(a => a.triggerTier === 2)?.triggeredAt ?? null;
        const tier3FiredAt = recentAdjustments.find(a => a.triggerTier === 3)?.triggeredAt ?? null;

        // Check for missed long run last Saturday
        const today = new Date();
        const dow = today.getDay();
        const daysToLastSat = dow === 6 ? 0 : (dow + 1);
        const lastSatStart = new Date(today);
        lastSatStart.setDate(today.getDate() - daysToLastSat);
        lastSatStart.setHours(0, 0, 0, 0);
        const lastSatEnd = new Date(lastSatStart);
        lastSatEnd.setDate(lastSatEnd.getDate() + 1);

        const satSession = await prisma.scheduledSession.findFirst({
          where: {
            planId: plan.id,
            date: { gte: lastSatStart, lt: lastSatEnd },
            sessionType: { in: ["LONG", "RACE_HALF", "RACE_MARATHON", "RACE_5K", "RACE_10K"] },
          },
        });
        const missedLongRun = satSession?.status === "MISSED";

        const adaptCtx: AdaptationContext = {
          recentScores: scores,
          lastRatingScore: lastScore,
          last3AvgScore: last3Avg,
          acwr,
          complianceRate: 1.0,
          daysSinceLastRun,
          missedLongRun,
          hrTrendBpm: null,
          tier2FiredAt,
          tier3FiredAt,
          currentWeek,
          totalWeeks,
          isInTaper,
        };

        const decision = determineTier(adaptCtx);
        if (decision.tier === 0) return;

        const upcomingSessions = plan.sessions;
        if (!upcomingSessions.length) return;

        const patches: SessionPatch[] = [];

        if (decision.tier === 1) {
          for (const sess of upcomingSessions) {
            const ctx: GuardrailContext = {
              originalDistanceKm: Number(sess.originalDistanceKm),
              higdonWeeklyKm: Number(sess.originalDistanceKm),
              currentWeek, totalWeeks,
              prevActualLongRunKm: null, recentPatchedAt: null,
              projectedACWR: acwr,
            };
            patches.push(buildTier1Patch(
              sess.id, Number(sess.currentDistanceKm), acwr, lastScore, ctx
            ));
          }
        } else if (decision.tier === 2) {
          for (const sess of upcomingSessions) {
            const ctx: GuardrailContext = {
              originalDistanceKm: Number(sess.originalDistanceKm),
              higdonWeeklyKm: Number(sess.originalDistanceKm),
              currentWeek, totalWeeks,
              prevActualLongRunKm: null, recentPatchedAt: null,
              projectedACWR: acwr,
            };
            patches.push(buildTier2Patch(
              sess.id, Number(sess.currentDistanceKm), acwr, decision.reason, ctx
            ));
          }
        } else if (decision.tier === 3) {
          const profile = await prisma.profile.findUnique({ where: { id: 1 } });
          const ageYears = profile?.dateOfBirth
            ? Math.floor(
                (Date.now() - new Date(profile.dateOfBirth).getTime()) / (365.25 * 86400000)
              )
            : 22;

          const guardrailCtxMap = new Map<string, GuardrailContext>(
            upcomingSessions.map(sess => [
              sess.id,
              {
                originalDistanceKm: Number(sess.originalDistanceKm),
                higdonWeeklyKm: Number(sess.originalDistanceKm),
                currentWeek, totalWeeks,
                prevActualLongRunKm: null, recentPatchedAt: null,
                projectedACWR: acwr,
              },
            ])
          );

          const tier3Input: Tier3Input = {
            athleteAge: ageYears,
            planTemplateKey: plan.templateKey,
            recentRatings: recentRatings.map(r => ({
              date: r.createdAt.toISOString().split("T")[0],
              score: Number(r.score),
              sessionType: "EASY",
            })),
            acwr, currentWeek, totalWeeks,
            upcomingSessions: upcomingSessions.map(s => ({
              id: s.id,
              date: s.date.toISOString().split("T")[0],
              sessionType: s.sessionType,
              distanceKm: Number(s.currentDistanceKm),
              targetPaceLow: s.targetPaceMinKmLow ? Number(s.targetPaceMinKmLow) : null,
              targetPaceHigh: s.targetPaceMinKmHigh ? Number(s.targetPaceMinKmHigh) : null,
            })),
            raceDate: plan.raceDate.toISOString().split("T")[0],
            avgWeatherTempC: null,
          };

          const llmPatches = await generateAdaptivePatch(tier3Input, guardrailCtxMap);
          patches.push(...llmPatches);
        }

        if (!patches.length) return;

        for (const patch of patches) {
          const { distanceKm, targetHrZone, notes } = patch.changes;
          await prisma.scheduledSession.update({
            where: { id: patch.scheduledSessionId },
            data: {
              ...(distanceKm !== undefined && { currentDistanceKm: distanceKm }),
              ...(targetHrZone !== undefined && { targetHrZone }),
              ...(notes !== undefined && { notes }),
              isAdjusted: true,
            },
          });
        }

        await prisma.planAdjustment.create({
          data: {
            planId: plan.id,
            triggerTier: decision.tier,
            triggerReason: decision.reason,
            source: "auto",
            patch: JSON.parse(JSON.stringify(patches)),
            applied: true,
            appliedAt: new Date(),
          },
        });

        await prisma.settings.update({
          where: { id: 1 },
          data: { lastACWR: acwr, lastATL: atl, lastCTL: ctl, lastMetricsDate: new Date() },
        });
      });
    }

    // Step 7: Generate Claude commentary (async, best-effort)
    await step.run("generate-commentary", async () => {
      const commentary = await generateCommentary(ratingResult.commentaryContext);
      if (!commentary) return null;

      await prisma.runRating.update({
        where: { id: savedRatingId },
        data: {
          llmHeadline: commentary.headline,
          llmExplanation: commentary.explanation,
          llmConfidence: commentary.confidence,
          llmModel: "claude-sonnet-4-6",
        },
      });

      return { headline: commentary.headline, confidence: commentary.confidence };
    });

    return { activityId, score: ratingResult.score };
  }
);
