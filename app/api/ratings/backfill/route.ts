import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { fetchWeatherAtTime } from "@/lib/weather/openMeteo";
import { computeRunRating, type ScoreInput, type SessionType, type CommentaryContext } from "@/lib/scoring/index";
import { generateCommentary } from "@/lib/llm/commentary";

export const dynamic = "force-dynamic";

export async function POST() {
  const activities = await prisma.activity.findMany({
    where: { activityType: { in: ["running", "trail_running"] }, rating: null },
    orderBy: { date: "asc" },
  });

  const profile = await prisma.profile.findUnique({ where: { id: 1 } });
  const ageYears = profile?.dateOfBirth
    ? Math.floor((Date.now() - new Date(profile.dateOfBirth).getTime()) / (365.25 * 86400000))
    : 22;

  let rated = 0;
  let failed = 0;
  const commentaryQueue: Array<{ ratingId: string; context: CommentaryContext }> = [];

  for (const activity of activities) {
    try {
      const scheduled = await prisma.scheduledSession.findFirst({
        where: {
          date: {
            gte: new Date(activity.date.getTime() - 24 * 60 * 60 * 1000),
            lte: new Date(activity.date.getTime() + 24 * 60 * 60 * 1000),
          },
        },
        orderBy: { date: "asc" },
      });

      const weather = activity.startLat && activity.startLon
        ? await fetchWeatherAtTime(activity.startLat, activity.startLon, activity.date)
        : null;

      const recentRatings = await prisma.runRating.findMany({
        orderBy: { createdAt: "desc" },
        take: 28,
        select: { score: true, rTSS: true, createdAt: true },
      });

      const input: ScoreInput = {
        activityId: activity.id,
        sessionType: (scheduled?.sessionType as SessionType) ?? "EASY",
        plannedKm: scheduled ? Number(scheduled.currentDistanceKm) : activity.distanceKm,
        actualKm: activity.distanceKm,
        durationSecs: activity.durationSecs,
        elapsedSecs: activity.elapsedTimeSecs ?? activity.durationSecs,
        avgPaceSecKm: activity.avgPaceSecKm,
        avgHR: activity.avgHeartRate,
        maxHR: activity.maxHeartRate,
        elevationGainM: activity.elevationGainM,
        splits: activity.splits as ScoreInput["splits"],
        targetPaceLowSecKm: scheduled?.targetPaceMinKmLow ? Number(scheduled.targetPaceMinKmLow) * 60 : null,
        targetPaceHighSecKm: scheduled?.targetPaceMinKmHigh ? Number(scheduled.targetPaceMinKmHigh) * 60 : null,
        targetHrZone: scheduled?.targetHrZone ?? null,
        ageYears,
        rftpSecKm: profile?.rftpSecPerKm ?? null,
        hrMax: profile?.hrMax ?? null,
        weatherTempC: weather?.tempC ?? null,
        weatherDewPointC: weather?.dewPointC ?? null,
        recentTSS: recentRatings.filter((r) => r.rTSS !== null).map((r) => ({ date: r.createdAt, tss: Number(r.rTSS) })),
        recent4wkAvgScore: recentRatings.length ? recentRatings.reduce((sum, r) => sum + Number(r.score), 0) / recentRatings.length : null,
      };

      const result = computeRunRating(input);

      const created = await prisma.runRating.create({
        data: {
          activityId: activity.id,
          scheduledId: scheduled?.id ?? null,
          score: result.score,
          distanceScore: result.distanceScore,
          paceScore: result.paceScore,
          hrScore: result.hrScore ?? 0,
          executionScore: result.executionScore,
          rTSS: result.rTSS,
          intensityFactor: result.intensityFactor,
          decouplingPct: result.decouplingPct,
          gapMinKm: result.gapSecKm ? result.gapSecKm / 60 : null,
          weatherTempC: result.weatherTempC,
          weatherDewPointC: result.weatherDewPointC,
          heatAdjusted: result.heatAdjusted,
          algorithmVersion: result.algorithmVersion,
        },
      });

      commentaryQueue.push({ ratingId: created.id, context: result.commentaryContext });
      rated += 1;
    } catch {
      failed += 1;
    }
  }

  void (async () => {
    for (const job of commentaryQueue) {
      const commentary = await generateCommentary(job.context);
      if (!commentary) continue;
      await prisma.runRating.update({
        where: { id: job.ratingId },
        data: {
          llmHeadline: commentary.headline,
          llmExplanation: commentary.explanation,
          llmConfidence: commentary.confidence,
          llmModel: "claude-sonnet-4-6",
        },
      });
    }
  })();

  return NextResponse.json({ total: activities.length, rated, failed });
}
