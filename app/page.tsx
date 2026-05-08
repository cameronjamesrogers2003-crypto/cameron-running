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
import { RunTypePill } from "@/components/RunTypePill";
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

function formatTargetPace(minPerKm: number): string {
  const mins = Math.floor(minPerKm);
  const secs = Math.round((minPerKm - mins) * 60);
  return `${mins}:${secs.toString().padStart(2, "0")} /km`;
}

function PlayerCard({ rating }: { rating: PlayerRatingLike | null }) {
  if (!rating) {
    return (
      <Card className="p-5">
        <SectionLabel>Player Card</SectionLabel>
        <div className="mt-4 rounded-2xl p-5 text-center" style={{ background: "#0b1020" }}>
          <p className="text-5xl font-black text-white tabular-nums">--</p>
          <p className="text-xs uppercase tracking-[0.3em] font-bold" style={{ color: "var(--text-muted)" }}>
            OVR
          </p>
          <p className="text-sm mt-4" style={{ color: "var(--text-muted)" }}>
            Visit /api/player-rating/initialize after deployment to seed your first rating.
          </p>
        </div>
      </Card>
    );
  }

  const overall = Math.round(rating.overall);
  const accent = playerRatingAccent(overall);

  return (
    <Card className="p-4 sm:p-5 overflow-hidden">
      <div
        className="relative rounded-3xl p-5 sm:p-6"
        style={{
          background:
            "radial-gradient(circle at 22% 0%, rgba(250,204,21,0.25), transparent 32%), linear-gradient(145deg, #101827 0%, #0b1020 48%, #050816 100%)",
          border: "1px solid rgba(250,204,21,0.32)",
          boxShadow: "inset 0 0 60px rgba(250,204,21,0.05)",
        }}
      >
        <div
          className="absolute inset-x-7 top-0 h-px"
          style={{ background: "linear-gradient(90deg, transparent, rgba(250,204,21,0.8), transparent)" }}
        />
        <div className="relative flex flex-col gap-5 md:flex-row md:items-center">
          <div className="flex items-center gap-4 md:w-48 md:flex-col md:items-start">
            <div>
              <p className="text-6xl sm:text-7xl font-black leading-none tabular-nums" style={{ color: accent }}>
                {overall}
              </p>
              <p className="text-xs uppercase tracking-[0.35em] font-extrabold text-white">OVR</p>
            </div>
            <div className="min-w-0">
              <p className="text-lg font-black uppercase tracking-wide text-white">Cameron</p>
              <p className="text-xs uppercase tracking-[0.2em]" style={{ color: "rgba(255,255,255,0.55)" }}>
                Running Card
              </p>
            </div>
          </div>

          <div className="grid flex-1 gap-3">
            {PLAYER_RATING_ATTRIBUTES.map((attr) => {
              const value = Math.round(rating[attr.key]);
              const width = Math.min(100, Math.max(0, (value / 99) * 100));
              const barColor = playerRatingAccent(value);
              return (
                <div key={attr.key} className="grid grid-cols-[42px_1fr_34px] items-center gap-3">
                  <div>
                    <p className="text-xs font-black tracking-wider text-white">{attr.label}</p>
                    <p className="text-[10px] hidden sm:block" style={{ color: "rgba(255,255,255,0.45)" }}>
                      {attr.name}
                    </p>
                  </div>
                  <div className="h-2.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.10)" }}>
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${width}%`,
                        background: `linear-gradient(90deg, ${barColor}, rgba(255,255,255,0.88))`,
                      }}
                    />
                  </div>
                  <p className="text-sm font-black text-right tabular-nums text-white">{value}</p>
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
      className={`rounded-2xl border bg-white/[0.04] border-white/[0.08] backdrop-blur-sm ${className}`}
      style={{
        borderRadius: "var(--card-radius)",
      }}
    >
      {children}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="text-xs font-semibold tracking-widest uppercase"
      style={{ color: "var(--text-label)" }}
    >
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
    <div className="flex flex-col lg:flex-row gap-5 lg:gap-5 items-start">
      {/* ── Main column ──────────────────────────────────────────────────── */}
      <div className="flex-1 min-w-0 space-y-4">

        {/* OAuth error */}
        {oauthError && (
          <div
            className="rounded-xl px-4 py-3 text-sm"
            style={{ background: "#2d1515", border: "1px solid #7f1d1d" }}
          >
            <p className="font-semibold text-red-400">
              {oauthError === "strava_denied"
                ? "Strava authorisation denied"
                : "Strava connection failed"}
            </p>
            <p className="mt-1 text-xs" style={{ color: "#fca5a5" }}>
              Something went wrong during authentication. Please try again.
            </p>
            {oauthErrorId && (
              <p className="mt-1 font-mono text-xs break-all" style={{ color: "#fca5a5" }}>
                Reference ID: {oauthErrorId}
              </p>
            )}
          </div>
        )}

        {/* Logo icon + phase header */}
        <Logo size="md" showWordmark={false} />

        {playerRating && showPlayerRatingSummary && (
          <PlayerRatingDeltaPanel
            updatedAt={playerRating.updatedAt.toISOString()}
            rows={playerRatingSummaryRows}
          />
        )}

        <div className="flex items-start justify-between mb-6 pt-2 gap-3">
          <div>
            <p className="text-sm font-medium mb-1" style={{ color: "var(--text-muted)" }}>
              Hey, Cameron.
            </p>
            <h1 className="text-2xl font-bold tracking-tight text-white">Dashboard</h1>
            <span
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold mt-2"
              style={{
                background: "var(--accent-dim)",
                color: "var(--accent)",
                border: "1px solid var(--accent-border)",
              }}
            >
              Week {currentWeek} · {currentPhase}
            </span>
          </div>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            {formatAEST(today, "EEEE, d MMMM yyyy")}
          </p>
        </div>

        <PlayerCard rating={playerRating} />

        {/* Today's plan — full width on small screens (sidebar is lg+) */}
        <div className="lg:hidden w-full">
          <Card className="p-4">
            <SectionLabel>Today&apos;s workout</SectionLabel>
            {todayPlanEntry ? (
              <div className="mt-3 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-white font-semibold text-sm">
                    {todayPlanEntry.dayLabel} {formatAEST(todayPlanEntry.date, "d MMM")}
                  </span>
                  <RunTypePill type={todayPlanEntry.session.type} size="sm" />
                  {todayPlanEntry.completed && (
                    <span className="text-xs font-medium text-green-400">Done</span>
                  )}
                </div>
                <p className="text-sm text-white font-mono">
                  {todayPlanEntry.session.targetDistanceKm} km ·{" "}
                  {formatTargetPace(todayPlanEntry.session.targetPaceMinPerKm)}
                </p>
                <p className="text-xs leading-snug" style={{ color: "var(--text-muted)" }}>
                  {todayPlanEntry.session.description}
                </p>
              </div>
            ) : (
              <p className="text-sm mt-2" style={{ color: "var(--text-muted)" }}>
                No structured session on the plan for today.
              </p>
            )}
          </Card>
        </div>

        {/* ── Stat tiles ─────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          {/* Weekly distance */}
          <Card className="p-4">
            <SectionLabel>Weekly Distance</SectionLabel>
            <p className="text-xl sm:text-2xl font-bold text-white mt-2 tabular-nums">
              {weekActualKm.toFixed(1)}
              <span className="text-xs sm:text-sm font-normal ml-1" style={{ color: "var(--text-muted)" }}>
                / {weekTargetKm.toFixed(1)} km
              </span>
            </p>
            <div
              className="mt-3 h-1 rounded-full overflow-hidden"
              style={{ background: "rgba(255,255,255,0.08)" }}
            >
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${Math.min(100, weekTargetKm > 0 ? (weekActualKm / weekTargetKm) * 100 : 0)}%`,
                  background: "var(--accent)",
                }}
              />
            </div>
          </Card>

          {/* Runs completed */}
          <Card className="p-4">
            <SectionLabel>Runs Completed</SectionLabel>
            <p className="text-xl sm:text-2xl font-bold text-white mt-2 tabular-nums">
              {weekDone}
              <span className="text-xs sm:text-sm font-normal ml-1" style={{ color: "var(--text-muted)" }}>
                / {weekPlanned}
              </span>
            </p>
            <p className="text-xs mt-3" style={{ color: "var(--text-muted)" }}>
              this week
            </p>
          </Card>

          {/* Avg rating */}
          <Card className="p-4">
            <SectionLabel>Avg Run Rating</SectionLabel>
            {avgWeekRating !== null ? (
              <>
                <p
                  className="text-xl sm:text-2xl font-bold mt-2 tabular-nums"
                  style={{ color: ratingStatColor(avgWeekRating) }}
                >
                  {avgWeekRating.toFixed(1)}
                  <span className="text-xs sm:text-sm font-normal ml-1 text-white">/ 10</span>
                </p>
                <p className="text-xs mt-3" style={{ color: "var(--text-muted)" }}>
                  from {weekRatings.length} {weekRatings.length === 1 ? "run" : "runs"}
                </p>
              </>
            ) : (
              <>
                <p className="text-xl sm:text-2xl font-bold mt-2" style={{ color: "var(--text-muted)" }}>
                  —
                </p>
                <p className="text-xs mt-3" style={{ color: "var(--text-muted)" }}>
                  no runs this week
                </p>
              </>
            )}
          </Card>
        </div>

        {/* ── Weekly km chart ─────────────────────────────────────────────── */}
        <Card className="p-4">
          <SectionLabel>Weekly Distance (km)</SectionLabel>
          <div className="mt-4">
            <WeeklyKmChart data={weeklyKmData} />
          </div>
        </Card>

        {/* ── Pace + Load charts side by side ─────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Card className="p-4">
            <SectionLabel>Avg Easy Pace</SectionLabel>
            <p className="text-xs mt-0.5 mb-3" style={{ color: "rgba(156,163,175,0.6)" }}>
              easy runs only · lower = faster
            </p>
            <AvgPaceTrendChart data={paceData} />
          </Card>
          <Card className="p-4">
            <SectionLabel>Training Load</SectionLabel>
            <p className="text-xs mt-0.5 mb-3" style={{ color: "rgba(156,163,175,0.6)" }}>
              km by run type
            </p>
            <TrainingLoadChart data={loadData} />
          </Card>
        </div>

        {/* ── Recent runs | Upcoming sessions (side by side on md+) ─────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Card>
            <div className="px-4 pt-4 pb-2">
              <SectionLabel>Recent Runs</SectionLabel>
            </div>
            {recentRunsRows.length === 0 ? (
              <div className="px-4 py-6 text-center">
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                  No completed runs yet. Sync Strava to import activities.
                </p>
              </div>
            ) : (
              recentRunsRows.map((run, idx) => {
                const score = run.rating;
                const badge = score != null ? ratingBadgeStyle(score) : { background: "rgba(255,255,255,0.06)", color: "var(--text-muted)" };
                return (
                  <div
                    key={run.id}
                    className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center"
                    style={{ borderTop: idx === 0 ? undefined : "1px solid rgba(255,255,255,0.06)" }}
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <div
                        className="w-11 h-11 shrink-0 rounded-lg flex items-center justify-center text-sm font-bold"
                        style={badge}
                      >
                        {score != null ? score.toFixed(1) : "—"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-white font-semibold text-sm break-words">
                            {run.name ?? `${run.distanceKm.toFixed(1)} km run`}
                          </span>
                          <RunTypePill type={run.runType} size="sm" />
                        </div>
                        <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                          {formatAEST(run.date, "EEE d MMM")}
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-xs sm:flex sm:flex-wrap sm:gap-4 sm:justify-end sm:ml-auto sm:text-right">
                      <div className="min-w-0">
                        <p className="text-white font-medium tabular-nums">{run.distanceKm.toFixed(2)} km</p>
                        <p style={{ color: "var(--text-muted)" }}>dist</p>
                      </div>
                      <div className="min-w-0">
                        <p className="text-white font-medium tabular-nums">
                          {run.avgPaceSecKm > 0 ? `${formatPace(run.avgPaceSecKm)} /km` : "—"}
                        </p>
                        <p style={{ color: "var(--text-muted)" }}>pace</p>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </Card>

          <Card>
            <div className="px-4 pt-4 pb-2">
              <SectionLabel>Upcoming Sessions</SectionLabel>
            </div>
            {upcomingSessions.length === 0 ? (
              <div className="px-4 py-6 text-center">
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                  No upcoming sessions in the plan, or all are already completed.
                </p>
              </div>
            ) : (
              upcomingSessions.map((row, idx) => {
                const s = row.session;
                return (
                  <div
                    key={`upcoming-${row.week}-${s.day}`}
                    className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center"
                    style={{ borderTop: idx === 0 ? undefined : "1px solid rgba(255,255,255,0.06)" }}
                  >
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <div
                        className="w-11 h-11 shrink-0 rounded-lg flex items-center justify-center text-xs font-bold"
                        style={{ background: "rgba(255,255,255,0.06)", color: "var(--text-muted)" }}
                      >
                        {row.dayLabel}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-white font-semibold text-sm capitalize">{s.type}</span>
                          <RunTypePill type={s.type} size="sm" />
                        </div>
                        <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                          {row.dayLabel} {formatAEST(row.date, "d MMM yyyy")}
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-xs sm:flex sm:gap-4 sm:ml-auto sm:text-right">
                      <div>
                        <p className="text-white font-medium font-mono">{s.targetDistanceKm} km</p>
                        <p style={{ color: "var(--text-muted)" }}>target</p>
                      </div>
                      <div>
                        <p className="text-white font-medium tabular-nums">{formatTargetPace(s.targetPaceMinPerKm)}</p>
                        <p style={{ color: "var(--text-muted)" }}>target pace</p>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </Card>
        </div>

        {/* ── Strava sync indicator ────────────────────────────────────────── */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:flex-wrap px-1 pb-2">
          <div
            className="flex flex-col gap-0.5 text-xs sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-1"
            style={{ color: "var(--text-muted)" }}
          >
            <span>Synced via Strava</span>
            <span className="hidden sm:inline" aria-hidden>
              ·
            </span>
            <span>Last run imported {lastRunImportedLabel}</span>
            <span className="hidden sm:inline" aria-hidden>
              ·
            </span>
            <span>Last refreshed {lastRefreshedLabel}</span>
          </div>
          <SyncButton
            lastSynced={lastSyncedAt}
            stravaConnected={profile?.stravaConnected ?? false}
          />
        </div>

      </div>

      {/* ── Sidebar ──────────────────────────────────────────────────────── */}
      <aside className="w-[220px] shrink-0 space-y-3 hidden lg:block">
        <PlanAdaptationCards initialItems={planAdaptations.map((item) => ({
          id: item.id,
          weekNumber: item.weekNumber,
          type: item.type,
          reason: item.reason,
          changes: item.changes,
        }))} />

        {/* This week panel */}
        <Card className="p-4">
          <SectionLabel>This Week</SectionLabel>
          <p className="text-sm font-semibold text-white mt-2 mb-1">
            Week {currentWeek} · {currentPhase}
          </p>

          {/* Progress bar */}
          <div className="flex justify-between text-xs mb-1">
            <span style={{ color: "var(--text-muted)" }}>{weekActualKm.toFixed(1)} km</span>
            <span style={{ color: "var(--text-muted)" }}>{weekTargetKm.toFixed(1)} km</span>
          </div>
          <div
            className="h-1.5 rounded-full overflow-hidden mb-4"
            style={{ background: "rgba(255,255,255,0.08)" }}
          >
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.min(100, weekTargetKm > 0 ? (weekActualKm / weekTargetKm) * 100 : 0)}%`,
                background: "var(--accent)",
              }}
            />
          </div>

          {/* Session checklist */}
          <div className="space-y-2.5">
            {lastWeekMisses > 0 && (
              <p className="text-xs font-medium" style={{ color: "#fbbf24" }}>
                You missed {lastWeekMisses} session{lastWeekMisses === 1 ? "" : "s"} last week
              </p>
            )}
            {sessionChecklist.map(({ session, date, completed, future, missed, active, dayLabel }) => (
              <div key={session.day} className="flex items-start gap-2.5">
                <div
                  className="w-4 h-4 rounded mt-0.5 flex items-center justify-center text-xs flex-shrink-0"
                  style={{
                    background: completed
                      ? "var(--accent)"
                      : missed
                        ? "rgba(251,191,36,0.35)"
                      : "rgba(255,255,255,0.08)",
                    color: completed ? "#fff" : missed ? "#fbbf24" : "transparent",
                  }}
                >
                  {completed ? "✓" : missed ? "×" : ""}
                </div>
                <div className="flex-1 min-w-0">
                  <p
                    className="text-xs font-medium leading-tight capitalize"
                    style={{ color: !active || completed ? "var(--text-muted)" : "white" }}
                  >
                    {dayLabel} · {session.type}{" "}
                    {session.targetDistanceKm} km @ {formatTargetPace(session.targetPaceMinPerKm)}
                  </p>
                  {future && !completed && (
                    <p
                      className="text-xs leading-tight"
                      style={{ color: "rgba(156,163,175,0.5)" }}
                    >
                      {formatAEST(date, "d MMM")}
                    </p>
                  )}
                </div>
              </div>
            ))}
            {sessionChecklist.length === 0 && (
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                No sessions this week
              </p>
            )}
          </div>
        </Card>

        {/* Phase progress */}
        <Card className="p-4">
          <SectionLabel>Phase Progress</SectionLabel>
          <p className="text-sm font-semibold text-white mt-2">{currentPhase}</p>
          <p className="text-xs mt-0.5 mb-2" style={{ color: "var(--text-muted)" }}>
            Week {currentWeek} of {totalWeeks}
          </p>
          <div
            className="h-1.5 rounded-full overflow-hidden mb-3"
            style={{ background: "rgba(255,255,255,0.08)" }}
          >
            <div
              className="h-full rounded-full"
              style={{
                width: `${phaseProgress}%`,
                background: phaseStyle(currentPhase).color,
              }}
            />
          </div>
          {raceSpecificWeek != null ? (
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Race Specific starts Week {raceSpecificWeek}
            </p>
          ) : (
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Race week is here 🏁
            </p>
          )}
        </Card>

        {/* Plan start reference */}
        <p className="text-xs px-1" style={{ color: "rgba(156,163,175,0.4)" }}>
          Plan starts {formatAEST(toBrisbaneYmd(planStart), "d MMM yyyy")}
        </p>

      </aside>
    </div>
  );
}
