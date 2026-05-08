import prisma from "@/lib/db";
import { formatPace } from "@/lib/settings";
import { buildTrainingPlan, type Phase, type Day, type PlanConfig, type RunType } from "@/data/trainingPlan";
import {
  getEffectivePlanStart,
  getPlanWeekForDate,
  getSessionDate,
  getWeeklyTargetKm,
  isActivityOnOrAfterPlanStart,
} from "@/lib/planUtils";
import { formatAEST, formatDistanceToNowAEST, sameDayAEST, startOfDayAEST, toBrisbaneYmd } from "@/lib/dateUtils";
import { inferRunType } from "@/lib/rating";
import { dbSettingsToUserSettings, DEFAULT_SETTINGS } from "@/lib/settings";
import { parseInterruptionType, reconfigurePlan, type PlanInterruption } from "@/lib/interruptions";
import { loadGeneratedPlan, saveGeneratedPlan } from "@/lib/planStorage";
import { finalizePlanDisplayCopy, generatePlan } from "@/lib/generatePlan";
import {
  buildPlayerRatingSummaryRows,
  PLAYER_RATING_ATTRIBUTES,
  playerRatingAccent,
  type PlayerRatingLike,
} from "@/lib/playerRating";
import WeeklyKmChart from "@/components/charts/WeeklyKmChart";
import AvgPaceTrendChart from "@/components/charts/AvgPaceTrendChart";
import TrainingLoadChart from "@/components/charts/TrainingLoadChart";
import SyncButton from "@/components/SyncButton";
import Logo from "@/components/Logo";
import PlayerRatingDeltaPanel from "@/components/PlayerRatingDeltaPanel";
import PlanAdaptationCards from "@/components/PlanAdaptationCards";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

function parseSettingsDays(trainingDaysJson: string | null): Day[] {
  if (!trainingDaysJson) return [];
  try {
    const parsed = JSON.parse(trainingDaysJson) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((d): d is Day =>
      d === "mon" || d === "tue" || d === "wed" || d === "thu" || d === "fri" || d === "sat" || d === "sun",
    );
  } catch {
    return [];
  }
}

// ── Style helpers ─────────────────────────────────────────────────────────────

function ratingBadgeStyle(score: number): { background: string; color: string } {
  if (score >= 9)   return { background: "#2e1065", color: "#c4b5fd" };
  if (score >= 7.5) return { background: "#052e16", color: "#4ade80" };
  if (score >= 6)   return { background: "#0c1a2e", color: "#60a5fa" };
  if (score >= 4)   return { background: "#431407", color: "#fb923c" };
  return               { background: "#450a0a", color: "#f87171" };
}

function ratingStatColor(score: number): string {
  if (score >= 7.5) return "#4ade80";
  if (score >= 6)   return "#60a5fa";
  if (score >= 4)   return "#fb923c";
  return "#f87171";
}

function phaseStyle(phase: Phase): { background: string; color: string } {
  switch (phase) {
    case "Base":
    case "Beginner Base":
    case "Intermediate Base":
    case "Advanced Base":
      return { background: "#1e3a5f", color: "#93c5fd" };
    case "Half Marathon Build":
    case "Race Specific":
      return { background: "#14532d", color: "#86efac" };
    case "Marathon Build":
      return { background: "#3b0764", color: "#d8b4fe" };
    case "Taper":
      return { background: "#3f3f46", color: "#e4e4e7" };
    case "Recovery":
      return { background: "#1a1133", color: "#a78bfa" };
  }
}

function runTypePillStyle(type: RunType): { background: string; color: string } {
  switch (type) {
    case "easy":     return { background: "#1e1b4b", color: "#a5b4fc" };
    case "tempo":    return { background: "#134e4a", color: "#5eead4" };
    case "interval": return { background: "#431407", color: "#fb923c" };
    case "long":     return { background: "#292524", color: "#d6d3d1" };
  }
}

function formatTargetPace(minPerKm: number): string {
  const mins = Math.floor(minPerKm);
  const secs = Math.round((minPerKm - mins) * 60);
  return `${mins}:${secs.toString().padStart(2, "0")} /km`;
}

function PlayerCard({ rating }: { rating: PlayerRatingLike | null }) {
  if (!rating) {
    return (
      <Card className="rs-card rs-player-card">
        <SectionLabel>Player Card</SectionLabel>
        <div className="rs-player-card__empty" style={{ background: "#0b1020" }}>
          <p className="rs-player-card__ovr rs-mono">--</p>
          <p className="rs-player-card__ovr-label" style={{ color: "var(--text-muted)" }}>
            OVR
          </p>
          <p className="rs-player-card__hint" style={{ color: "var(--text-muted)" }}>
            Visit /api/player-rating/initialize after deployment to seed your first rating.
          </p>
        </div>
      </Card>
    );
  }

  const overall = Math.round(rating.overall);
  const accent = playerRatingAccent(overall);

  return (
    <Card className="rs-card rs-player-card">
      <div
        className="rs-player-card__shell"
        style={{
          background:
            "radial-gradient(circle at 22% 0%, rgba(250,204,21,0.25), transparent 32%), linear-gradient(145deg, #101827 0%, #0b1020 48%, #050816 100%)",
          border: "1px solid rgba(250,204,21,0.32)",
          boxShadow: "inset 0 0 60px rgba(250,204,21,0.05)",
        }}
      >
        <div
          className="rs-player-card__shine"
          style={{ background: "linear-gradient(90deg, transparent, rgba(250,204,21,0.8), transparent)" }}
        />
        <div className="rs-player-card__content">
          <div className="rs-player-card__identity">
            <div>
              <p className="rs-player-card__ovr rs-mono" style={{ color: accent }}>
                {overall}
              </p>
              <p className="rs-player-card__ovr-label">OVR</p>
            </div>
            <div className="rs-player-card__name-wrap">
              <p className="rs-player-card__name">Cameron</p>
              <p className="rs-player-card__sub" style={{ color: "rgba(255,255,255,0.55)" }}>
                Running Card
              </p>
            </div>
          </div>

          <div className="rs-player-card__stats">
            {PLAYER_RATING_ATTRIBUTES.map((attr) => {
              const value = Math.round(rating[attr.key]);
              const width = Math.min(100, Math.max(0, (value / 99) * 100));
              const barColor = playerRatingAccent(value);
              return (
                <div key={attr.key} className="rs-player-card__stat-row">
                  <div>
                    <p className="rs-player-card__attr-label">{attr.label}</p>
                    <p className="rs-player-card__attr-name" style={{ color: "rgba(255,255,255,0.45)" }}>
                      {attr.name}
                    </p>
                  </div>
                  <div className="rs-player-card__meter" style={{ background: "rgba(255,255,255,0.10)" }}>
                    <div
                      className="rs-player-card__meter-fill"
                      style={{
                        width: `${width}%`,
                        background: `linear-gradient(90deg, ${barColor}, rgba(255,255,255,0.88))`,
                      }}
                    />
                  </div>
                  <p className="rs-player-card__value rs-mono">{value}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </Card>
  );
}

// ── Card wrapper ─────────────────────────────────────────────────────────────

function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={className}
      style={{
        background: "#181818",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 12,
      }}
    >
      {children}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="rs-stat-label" style={{ color: "var(--text-muted)" }}>
      {children}
    </p>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const oauthError = params.error as string | undefined;
  const oauthErrorIdParam = params.id;
  const oauthErrorId = typeof oauthErrorIdParam === "string" ? oauthErrorIdParam : undefined;

  const today = new Date();
  const todayAESTMidnight = startOfDayAEST(today);

  const [profile, userSettingsRow, lastSyncRow, interruptionRows, playerRating, planAdaptations] = await Promise.all([
    prisma.profile.findUnique({ where: { id: 1 } }),
    prisma.userSettings.findUnique({ where: { id: 1 } }),
    prisma.activity.findFirst({
      where: { activityType: { in: ["running", "trail_running"] } },
      orderBy: { syncedAt: "desc" },
    }),
    prisma.planInterruption.findMany({ orderBy: { startDate: "asc" } }),
    prisma.playerRating.findFirst({ orderBy: { updatedAt: "desc" } }),
    prisma.planAdaptation.findMany({
      where: { dismissed: false },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const settings = userSettingsRow ? dbSettingsToUserSettings(userSettingsRow) : DEFAULT_SETTINGS;
  if ((settings.experienceLevel == null) && Boolean(profile?.stravaConnected)) {
    redirect("/onboarding");
  }
  const planStart = getEffectivePlanStart(settings.planStartDate);

  // Prefer generated plan from DB; fallback to legacy pipeline.
  const stored = await loadGeneratedPlan();
  const settingsDays = parseSettingsDays(settings.trainingDays);
  if (stored?.plan?.length && settings.experienceLevel && settingsDays.length > 0) {
    const storedDays = new Set<Day>();
    for (const week of stored.plan) {
      for (const session of week.sessions) {
        storedDays.add(session.day);
      }
    }
    const settingsDaySet = new Set(settingsDays);
    const hasDrift =
      [...storedDays].some((d) => !settingsDaySet.has(d))
      || [...settingsDaySet].some((d) => !storedDays.has(d));
    if (hasDrift) {
      const config: PlanConfig = {
        level: settings.experienceLevel,
        goal: settings.goalRace === "FULL" ? "full" : "hm",
        weeks: (settings.planLengthWeeks ?? 16) as 12 | 16 | 20,
        days: settingsDays,
        longRunDay:
          settings.longRunDay === "mon" || settings.longRunDay === "tue" || settings.longRunDay === "wed"
          || settings.longRunDay === "thu" || settings.longRunDay === "fri" || settings.longRunDay === "sat"
          || settings.longRunDay === "sun"
            ? settings.longRunDay
            : undefined,
        vdot: settings.currentVdot ?? 33,
        paceAdjust: {
          easyPaceOffsetSec: settings.easyPaceOffsetSec,
          tempoPaceOffsetSec: settings.tempoPaceOffsetSec,
          intervalPaceOffsetSec: settings.intervalPaceOffsetSec,
          longPaceOffsetSec: settings.longPaceOffsetSec,
          runningExperience: settings.runningExperience,
        },
      };
      const regenerated = generatePlan(config);
      await saveGeneratedPlan(config, regenerated);
      redirect("/");
    }
  }
  let planToRender = stored?.plan ?? [];
  if (!planToRender.length) {
    const basePlan = buildTrainingPlan(settings);
    const normalWeeklyKm =
      basePlan.reduce((sum, w) => sum + getWeeklyTargetKm(w), 0) / basePlan.length;
    const interruptions: PlanInterruption[] = interruptionRows.map((row) => ({
      id:               row.id,
      reason:           row.reason,
      type:             parseInterruptionType(row.type),
      startDate:        new Date(row.startDate),
      endDate:          row.endDate ? new Date(row.endDate) : null,
      weeklyKmEstimate: row.weeklyKmEstimate ?? null,
      notes:            row.notes ?? null,
      weeksAffected:    row.weeksAffected ?? null,
    }));
    planToRender = reconfigurePlan(basePlan, interruptions, {
      isBeginnerCurve: true,
      raceDate: settings.raceDate ? new Date(settings.raceDate) : null,
      normalWeeklyKm,
      planStart,
      experienceLevel: settings.experienceLevel ?? "BEGINNER",
    }).plan;
  }

  if (planToRender.length) {
    finalizePlanDisplayCopy(planToRender, settings.experienceLevel ?? "BEGINNER");
  }

  const lastPlanWeekNum = planToRender[planToRender.length - 1]?.week ?? planToRender.length;
  const rawCalendarWeek = getPlanWeekForDate(today, planStart);
  const currentWeek =
    rawCalendarWeek > 0 ? Math.min(lastPlanWeekNum, rawCalendarWeek) : 1;
  const currentPlanWeek = planToRender.find((w) => w.week === currentWeek) ?? planToRender[0];
  const currentPhase = currentPlanWeek?.phase ?? "Base";

  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  const dayOfWeekAESTMonFirst = (new Date(today.getTime() + 10 * 60 * 60 * 1000).getUTCDay() + 6) % 7;
  const weekStart = new Date(todayAESTMidnight.getTime() - dayOfWeekAESTMonFirst * MS_PER_DAY);
  const weekEnd = new Date(weekStart.getTime() + 7 * MS_PER_DAY);

  const chartStartWeek = Math.max(1, currentWeek - 3);
  const chartRangeStart = new Date(weekStart.getTime() - 3 * 7 * MS_PER_DAY);

  const [recentRuns, weekActivities, chartActivities, runsPlanForward] = await Promise.all([
    prisma.activity.findMany({
      where: { activityType: { in: ["running", "trail_running"] } },
      orderBy: { date: "desc" },
      take: 5,
    }),
    prisma.activity.findMany({
      where: {
        date: { gte: weekStart, lt: weekEnd },
        activityType: { in: ["running", "trail_running"] },
      },
    }),
    prisma.activity.findMany({
      where: {
        date: { gte: chartRangeStart },
        activityType: { in: ["running", "trail_running"] },
      },
      orderBy: { date: "asc" },
    }),
    prisma.activity.findMany({
      where: {
        date: { gte: todayAESTMidnight },
        activityType: { in: ["running", "trail_running"] },
      },
      orderBy: { date: "asc" },
    }),
  ]);

  // ── Stat tile data ────────────────────────────────────────────────────────
  const weekTargetKmRaw = currentPlanWeek ? getWeeklyTargetKm(currentPlanWeek) : 0;
  const weekActualKmRaw = weekActivities.reduce((s, a) => s + a.distanceKm, 0);
  const weekTargetKm = Math.round(weekTargetKmRaw * 10) / 10;
  const weekActualKm = Math.round(weekActualKmRaw * 10) / 10;
  const weekPlanned =
    Array.isArray(stored?.config?.days) && stored.config.days.length > 0
      ? stored.config.days.length
      : (currentPlanWeek?.sessions.length ?? 0);
  const weekDone = weekActivities.length;

  const weekRatings = weekActivities
    .map((a) => a.rating)
    .filter((r): r is number => r != null && !Number.isNaN(r));
  const avgWeekRating =
    weekRatings.length > 0
      ? Math.round(
          (weekRatings.reduce((a, b) => a + b, 0) / weekRatings.length) * 10
        ) / 10
      : null;

  // ── Chart data ────────────────────────────────────────────────────────────
  const chartWeekNums = Array.from({ length: 4 }, (_, i) => chartStartWeek + i);

  const weeklyKmData = chartWeekNums.map((wn) => {
    const planWeek = planToRender.find((w) => w.week === wn);
    const idx = wn - chartStartWeek;
    const wStart = new Date(chartRangeStart.getTime() + idx * 7 * MS_PER_DAY);
    const wEnd = new Date(wStart.getTime() + 7 * MS_PER_DAY);
    const actual = chartActivities
      .filter((a) => {
        const d = new Date(a.date);
        return d >= wStart && d < wEnd;
      })
      .reduce((s, a) => s + a.distanceKm, 0);
    return {
      week: `${formatAEST(wStart, "d MMM")}–${formatAEST(new Date(wEnd.getTime() - MS_PER_DAY), "d MMM")}`,
      actual: Math.round(actual * 10) / 10,
      target: planWeek ? getWeeklyTargetKm(planWeek) : 0,
    };
  });

  const paceData = chartWeekNums.map((wn) => {
    const idx = wn - chartStartWeek;
    const wStart = new Date(chartRangeStart.getTime() + idx * 7 * MS_PER_DAY);
    const wEnd = new Date(wStart.getTime() + 7 * MS_PER_DAY);
    const easyRuns = chartActivities.filter((a) => {
      const d = new Date(a.date);
      return (
        d >= wStart
        && d < wEnd
        && inferRunType(a, settings) === "easy"
      );
    });
    const avgPace =
      easyRuns.length > 0
        ? Math.round(
            easyRuns.reduce((s, a) => s + a.avgPaceSecKm, 0) / easyRuns.length
          )
        : null;
    return { week: `W${wn}`, paceSecKm: avgPace };
  });

  const loadData = chartWeekNums.map((wn) => {
    const idx = wn - chartStartWeek;
    const wStart = new Date(chartRangeStart.getTime() + idx * 7 * MS_PER_DAY);
    const wEnd = new Date(wStart.getTime() + 7 * MS_PER_DAY);
    const groups = { easy: 0, tempo: 0, interval: 0, long: 0 };
    chartActivities
      .filter((a) => {
        const d = new Date(a.date);
        return d >= wStart && d < wEnd;
      })
      .forEach((a) => {
        const type = inferRunType(a, settings);
        groups[type] = Math.round((groups[type] + a.distanceKm) * 10) / 10;
      });
    return { week: `W${wn}`, ...groups };
  });

  // ── Recent runs (DB: rating + classifiedRunType via inferRunType fallback) ─
  const recentRunsRows = recentRuns.map((a) => ({
    ...a,
    runType: inferRunType(a, settings),
    rating: a.rating != null && !Number.isNaN(a.rating) ? a.rating : null,
  }));

  function hasRunOnCalendarDay(activities: { date: Date }[], day: Date): boolean {
    return activities.some((a) => {
      const d = new Date(a.date);
      return sameDayAEST(d, day) && isActivityOnOrAfterPlanStart(d, planStart);
    });
  }

  // ── Upcoming: next 5 future plan sessions (no completed days) ─────────────
  type UpcomingRow = {
    session: (typeof planToRender)[0]["sessions"][0];
    date: Date;
    week: number;
    dayLabel: string;
  };
  const DAY_LABEL: Record<Day, string> = { mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu", fri: "Fri", sat: "Sat", sun: "Sun" };
  const upcomingCandidates: UpcomingRow[] = [];
  const brisbaneToday = startOfDayAEST(today);
  if (stored?.plan?.length) {
    for (const week of stored.plan) {
      if (week.week < currentWeek) continue;
      for (const session of week.sessions) {
        const sessionDate = getSessionDate(week.week, session.day, planStart);
        if (sessionDate <= brisbaneToday) continue;
        if (hasRunOnCalendarDay(runsPlanForward, sessionDate)) continue;
        upcomingCandidates.push({
          session,
          date: sessionDate,
          week: week.week,
          dayLabel: DAY_LABEL[session.day],
        });
      }
    }
  } else {
    for (let w = currentWeek; w <= lastPlanWeekNum; w++) {
      const pw = planToRender.find((x) => x.week === w);
      if (!pw) continue;
      for (const session of pw.sessions) {
        const date = getSessionDate(w, session.day, planStart);
        if (date <= todayAESTMidnight) continue;
        if (hasRunOnCalendarDay(runsPlanForward, date)) continue;
        upcomingCandidates.push({ session, date, week: w, dayLabel: DAY_LABEL[session.day] });
      }
    }
  }
  upcomingCandidates.sort((a, b) => a.date.getTime() - b.date.getTime());
  const upcomingSessions = upcomingCandidates.slice(0, 5);

  // ── Sidebar checklist: same week + sessions as Program page (planToRender) ─
  const CHECKLIST_DAY_ORDER: Day[] = ["sat", "sun", "mon", "tue", "wed", "thu", "fri"]; // matches Saturday-anchored scheduling
  const sessionChecklist = [...(currentPlanWeek?.sessions ?? [])]
    .sort((a, b) => CHECKLIST_DAY_ORDER.indexOf(a.day) - CHECKLIST_DAY_ORDER.indexOf(b.day))
    .map((session) => {
      const date = getSessionDate(currentWeek, session.day, planStart);
      const completed = weekActivities.some((a) => {
        const d = new Date(a.date);
        return sameDayAEST(d, date) && isActivityOnOrAfterPlanStart(d, planStart);
      });
      const future = date >= todayAESTMidnight;
      const active = isActivityOnOrAfterPlanStart(date, planStart);
      const missed = !completed && !future && active;
      return { session, date, completed, future, missed, active, dayLabel: DAY_LABEL[session.day] };
    });

  const lastWeekPlan = planToRender.find((week) => week.week === currentWeek - 1);
  const lastWeekMisses = (lastWeekPlan?.sessions ?? []).reduce((count, session) => {
    const date = getSessionDate(currentWeek - 1, session.day, planStart);
    if (date >= todayAESTMidnight) return count;
    const completed = chartActivities.concat(weekActivities, runsPlanForward).some((a) => {
      const d = new Date(a.date);
      return sameDayAEST(d, date) && isActivityOnOrAfterPlanStart(d, planStart);
    });
    return completed ? count : count + 1;
  }, 0);

  // ── Sidebar: phase progress ───────────────────────────────────────────────
  const phaseWeeks = planToRender.filter((w) => w.phase === currentPhase);
  const phaseStart = phaseWeeks[0]?.week ?? 1;
  const phaseEnd = phaseWeeks[phaseWeeks.length - 1]?.week ?? lastPlanWeekNum;
  const phaseProgress = Math.min(
    100,
    Math.round(
      ((currentWeek - phaseStart) / Math.max(1, phaseEnd - phaseStart + 1)) * 100
    )
  );
  const totalWeeks = planToRender.length;
  const raceSpecificWeek =
    planToRender.find((w) => {
      const phase = w.phase.toLowerCase();
      return phase.includes("build") || phase.includes("race specific");
    })?.week ?? null;

  // ── Sync timestamps (Strava) ──────────────────────────────────────────────
  const lastSyncedAt = lastSyncRow?.syncedAt?.toISOString() ?? null;
  const lastRunImportedLabel = lastSyncRow?.syncedAt
    ? formatDistanceToNowAEST(lastSyncRow.syncedAt, { addSuffix: true })
    : "never";
  const lastRefreshedLabel = profile?.lastRefreshedAt
    ? formatDistanceToNowAEST(profile.lastRefreshedAt, { addSuffix: true })
    : "Never refreshed";

  const todayPlanEntry = sessionChecklist.find((row) => sameDayAEST(row.date, today));
  const playerRatingSummaryRows = playerRating
    ? buildPlayerRatingSummaryRows(playerRating, lastSyncRow, settings)
    : [];
  const playerRatingUpdatedAt = playerRating ? new Date(playerRating.updatedAt) : null;
  const showPlayerRatingSummary = Boolean(
    playerRating
      && lastSyncRow
      && playerRatingSummaryRows.length > 0
      && playerRatingUpdatedAt
      && playerRatingUpdatedAt.getTime() >= lastSyncRow.syncedAt.getTime()
      && playerRatingUpdatedAt.getTime() - lastSyncRow.syncedAt.getTime() <= 10 * 60 * 1000,
  );

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="rs-page">
      <div className="rs-page__head">
        <div>
          <p className="rs-page__greeting">Dashboard</p>
          <h1 className="rs-page__title">Today&apos;s training</h1>
        </div>
        <p className="rs-page__date">{formatAEST(today, "EEEE, d MMMM yyyy")}</p>
      </div>

        {/* OAuth error */}
        {oauthError && (
          <div
            className="rs-card rs-alert"
            style={{ background: "#2d1515", border: "1px solid #7f1d1d" }}
          >
            <p className="rs-alert__title">
              {oauthError === "strava_denied"
                ? "Strava authorisation denied"
                : "Strava connection failed"}
            </p>
            <p className="rs-alert__body" style={{ color: "#fca5a5" }}>
              Something went wrong during authentication. Please try again.
            </p>
            {oauthErrorId && (
              <p className="rs-alert__id rs-mono" style={{ color: "#fca5a5" }}>
                Reference ID: {oauthErrorId}
              </p>
            )}
          </div>
        )}

        {playerRating && showPlayerRatingSummary && (
          <PlayerRatingDeltaPanel
            updatedAt={playerRating.updatedAt.toISOString()}
            rows={playerRatingSummaryRows}
          />
        )}

      <div className="rs-hero rs-hero--asym">
        <div>
          <p className="rs-hero__eyebrow">Today&apos;s run</p>
          <h2 className="rs-hero__asym-title">
            <span className="rs-hero__asym-type">{todayPlanEntry?.session.type ?? "rest"}</span>
            <span className="rs-hero__asym-num">
              {(todayPlanEntry?.session.targetDistanceKm ?? 0).toFixed(1)}
              <span>km</span>
            </span>
          </h2>
          <p className="rs-hero__asym-effort">
            {todayPlanEntry
              ? todayPlanEntry.session.description
              : "No structured session today. Keep effort easy and recover."}
          </p>
          <div className="rs-hero__asym-meta">
            <div>
              <p className="rs-stat-label">Target pace</p>
              <p className="rs-hero__stat-pace">
                {todayPlanEntry ? formatTargetPace(todayPlanEntry.session.targetPaceMinPerKm) : "—"}
              </p>
            </div>
            <div>
              <p className="rs-stat-label">Phase</p>
              <p className="rs-hero__stat-pace">Week {currentWeek} · {currentPhase}</p>
            </div>
          </div>
        </div>
        <div className="rs-hero__asym-week">
          <Logo size="md" showWordmark={false} />
        </div>
      </div>

      <PlayerCard rating={playerRating} />

      <div className="rs-status">
        <div className="rs-card rs-status__card">
          <SectionLabel>Weekly Distance</SectionLabel>
          <div className="rs-status__row">
            <p className="rs-status__primary rs-mono">{weekActualKm.toFixed(1)} / {weekTargetKm.toFixed(1)} km</p>
          </div>
          <div className="rs-status__bar">
            <div
              className="rs-status__bar-fill"
              style={{
                width: `${Math.min(100, weekTargetKm > 0 ? (weekActualKm / weekTargetKm) * 100 : 0)}%`,
                background: "var(--accent)",
              }}
            />
          </div>
          <p className="rs-stat-sub">distance this week</p>
        </div>

        <div className="rs-card rs-status__card">
          <SectionLabel>Runs Completed</SectionLabel>
          <div className="rs-status__row">
            <p className="rs-status__primary rs-mono">{weekDone} / {weekPlanned}</p>
          </div>
          <p className="rs-stat-sub">sessions this week</p>
        </div>

        <div className="rs-card rs-status__card">
          <SectionLabel>Avg Run Rating</SectionLabel>
          <div className="rs-status__row">
            <p className="rs-status__primary rs-mono" style={{ color: avgWeekRating !== null ? ratingStatColor(avgWeekRating) : "var(--text-muted)" }}>
              {avgWeekRating !== null ? `${avgWeekRating.toFixed(1)} / 10` : "—"}
            </p>
          </div>
          <p className="rs-stat-sub">{avgWeekRating !== null ? `from ${weekRatings.length} runs` : "no runs this week"}</p>
        </div>
      </div>

      <Card className="rs-card rs-block">
        <SectionLabel>Weekly Distance (km)</SectionLabel>
        <WeeklyKmChart data={weeklyKmData} />
      </Card>

      <div className="rs-two-col">
        <Card className="rs-card rs-block">
          <SectionLabel>Avg Easy Pace</SectionLabel>
          <AvgPaceTrendChart data={paceData} />
        </Card>
        <Card className="rs-card rs-block">
          <SectionLabel>Training Load</SectionLabel>
          <TrainingLoadChart data={loadData} />
        </Card>
      </div>

      <div className="rs-dash__grid">
        <Card className="rs-card rs-recent">
          <div className="rs-recent__head">
            <SectionLabel>Recent Runs</SectionLabel>
          </div>
          {recentRunsRows.length === 0 ? (
            <p className="rs-stat-sub">No completed runs yet. Sync Strava to import activities.</p>
          ) : (
            <ul className="rs-recent__list">
              {recentRunsRows.map((run) => {
                const pill = runTypePillStyle(run.runType);
                const score = run.rating;
                return (
                  <li key={run.id} className="rs-recent__row">
                    <div className="rs-recent__rating" data-feel="strong">
                      <span className="rs-mono">{score != null ? score.toFixed(1) : "—"}</span>
                    </div>
                    <div className="rs-recent__main">
                      <div className="rs-recent__title-row">
                        <span className="rs-recent__name">{run.name ?? `${run.distanceKm.toFixed(1)} km run`}</span>
                        <span className="rs-type-pill" style={pill}>
                          <span className="rs-type-pill__dot" style={{ background: pill.color }} />
                          {run.runType}
                        </span>
                      </div>
                      <p className="rs-recent__date">{formatAEST(run.date, "EEE d MMM")}</p>
                    </div>
                    <div className="rs-recent__stats">
                      <p className="rs-mono">{run.distanceKm.toFixed(2)} km</p>
                      <p className="rs-recent__pace rs-mono">{run.avgPaceSecKm > 0 ? `${formatPace(run.avgPaceSecKm)} /km` : "—"}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card className="rs-card rs-insight">
          <div className="rs-insight__mascot">
            <Logo size="sm" showWordmark={false} />
          </div>
          <div>
            <p className="rs-insight__eyebrow rs-stat-label">Insight</p>
            <p className="rs-insight__title">Momentum is building</p>
            <p className="rs-insight__body">
              {upcomingSessions.length > 0
                ? `Next up: ${upcomingSessions[0].session.type} on ${upcomingSessions[0].dayLabel}. Keep easy days controlled so quality sessions stay sharp.`
                : "No upcoming sessions are pending right now. Keep consistency high and recover well for the next block."}
            </p>
          </div>
        </Card>
      </div>

      <Card className="rs-card rs-upcoming">
        <SectionLabel>Upcoming Sessions</SectionLabel>
        {upcomingSessions.length === 0 ? (
          <p className="rs-stat-sub">No upcoming sessions in the plan, or all are already completed.</p>
        ) : (
          <ul className="rs-recent__list">
            {upcomingSessions.map((row) => {
              const s = row.session;
              const pill = runTypePillStyle(s.type);
              return (
                <li key={`upcoming-${row.week}-${s.day}`} className="rs-recent__row">
                  <div className="rs-recent__rating" data-feel="easy">
                    <span>{row.dayLabel}</span>
                  </div>
                  <div className="rs-recent__main">
                    <div className="rs-recent__title-row">
                      <span className="rs-recent__name">{s.type}</span>
                      <span className="rs-type-pill" style={pill}>
                        <span className="rs-type-pill__dot" style={{ background: pill.color }} />
                        {s.type}
                      </span>
                    </div>
                    <p className="rs-recent__date">{row.dayLabel} {formatAEST(row.date, "d MMM yyyy")}</p>
                  </div>
                  <div className="rs-recent__stats">
                    <p>{s.targetDistanceKm} km</p>
                    <p className="rs-recent__pace rs-mono">{formatTargetPace(s.targetPaceMinPerKm)}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <div className="rs-sync-row">
        <div className="rs-sync-copy" style={{ color: "var(--text-muted)" }}>
          <span>Synced via Strava</span>
          <span> · </span>
          <span>Last run imported {lastRunImportedLabel}</span>
          <span> · </span>
          <span>Last refreshed {lastRefreshedLabel}</span>
        </div>
        <SyncButton
          lastSynced={lastSyncedAt}
          stravaConnected={profile?.stravaConnected ?? false}
        />
      </div>

      <aside className="rs-sidebar-panel">
        <PlanAdaptationCards initialItems={planAdaptations.map((item) => ({
          id: item.id,
          weekNumber: item.weekNumber,
          type: item.type,
          reason: item.reason,
          changes: item.changes,
        }))} />

        <Card className="rs-card rs-panel-card">
          <SectionLabel>This Week</SectionLabel>
          <p className="rs-panel-title">Week {currentWeek} · {currentPhase}</p>
          <div className="rs-status__bar">
            <div
              className="rs-status__bar-fill"
              style={{
                width: `${Math.min(100, weekTargetKm > 0 ? (weekActualKm / weekTargetKm) * 100 : 0)}%`,
                background: "var(--accent)",
              }}
            />
          </div>
          <div className="rs-panel-list">
            {sessionChecklist.map(({ session, completed, missed, dayLabel }) => (
              <div key={session.day} className="rs-panel-item">
                <span className="rs-panel-item__mark">
                  {completed ? "✓" : missed ? "×" : "·"}
                </span>
                <span>
                  {dayLabel} · {session.type} {session.targetDistanceKm} km @ {formatTargetPace(session.targetPaceMinPerKm)}
                </span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="rs-card rs-panel-card">
          <SectionLabel>Phase Progress</SectionLabel>
          <p className="rs-panel-title">{currentPhase}</p>
          <div className="rs-status__bar">
            <div
              className="rs-status__bar-fill"
              style={{
                width: `${phaseProgress}%`,
                background: phaseStyle(currentPhase).color,
              }}
            />
          </div>
          <p className="rs-stat-sub">
            {raceSpecificWeek != null
              ? `Race Specific starts Week ${raceSpecificWeek}`
              : "Race week is here 🏁"}
          </p>
        </Card>
      </aside>
    </div>
  );
}
