import prisma from "@/lib/db";
import { formatPace } from "@/lib/strava";
import { buildTrainingPlan, trainingPlan, type Phase, type RunType, type Day } from "@/data/trainingPlan";
import {
  PLAN_START_DATE,
  getEffectivePlanStart,
  getPlanWeekForDate,
  getSessionDate,
  getWeeklyTargetKm,
  getNextPhaseInfo,
  isActivityOnOrAfterPlanStart,
} from "@/lib/planUtils";
import { formatAEST, formatDistanceToNowAEST, sameDayAEST, startOfDayAEST } from "@/lib/dateUtils";
import { inferRunType } from "@/lib/rating";
import { dbSettingsToUserSettings, DEFAULT_SETTINGS } from "@/lib/settings";
import { reconfigurePlan, type PlanInterruption, type InterruptionType } from "@/lib/interruptions";
import WeeklyKmChart from "@/components/charts/WeeklyKmChart";
import AvgPaceTrendChart from "@/components/charts/AvgPaceTrendChart";
import TrainingLoadChart from "@/components/charts/TrainingLoadChart";
import SyncButton from "@/components/SyncButton";
import Logo from "@/components/Logo";

export const dynamic = "force-dynamic";

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
    case "Base":                return { background: "#1e3a5f", color: "#93c5fd" };
    case "Half Marathon Build": return { background: "#14532d", color: "#86efac" };
    case "Marathon Build":      return { background: "#3b0764", color: "#d8b4fe" };
    case "Recovery":            return { background: "#1a1133", color: "#a78bfa" };
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
    <p
      className="text-xs uppercase tracking-wider"
      style={{ color: "var(--text-muted)" }}
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
  const oauthDetail = params.detail as string | undefined;

  const today = new Date();
  const todayAESTMidnight = startOfDayAEST(today);

  const [profile, userSettingsRow, lastSyncRow, interruptionRows] = await Promise.all([
    prisma.profile.findUnique({ where: { id: 1 } }),
    prisma.userSettings.findUnique({ where: { id: 1 } }),
    prisma.activity.findFirst({ orderBy: { syncedAt: "desc" } }),
    prisma.planInterruption.findMany({ orderBy: { startDate: "asc" } }),
  ]);

  const settings = userSettingsRow ? dbSettingsToUserSettings(userSettingsRow) : DEFAULT_SETTINGS;
  const planStart = getEffectivePlanStart(settings.planStartDate);
  // Session scheduling stays on the fixed plan anchor; planStart gates completion only.
  const scheduleAnchor = PLAN_START_DATE;

  // Same plan pipeline as app/program/page.tsx (VDOT base + interruptions)
  const basePlan = buildTrainingPlan(settings);
  const normalWeeklyKm =
    basePlan.reduce((sum, w) => sum + getWeeklyTargetKm(w), 0) / basePlan.length;
  const interruptions: PlanInterruption[] = interruptionRows.map((row) => ({
    id:               row.id,
    reason:           row.reason,
    type:             row.type as InterruptionType,
    startDate:        new Date(row.startDate),
    endDate:          row.endDate ? new Date(row.endDate) : null,
    weeklyKmEstimate: row.weeklyKmEstimate ?? null,
    notes:            row.notes ?? null,
    weeksAffected:    row.weeksAffected ?? null,
  }));
  const { plan: planToRender } = reconfigurePlan(basePlan, interruptions, {
    isBeginnerCurve: true,
    raceDate: settings.raceDate ? new Date(settings.raceDate) : null,
    normalWeeklyKm,
    planStart,
  });

  const lastPlanWeekNum = planToRender[planToRender.length - 1]?.week ?? trainingPlan.length;
  const rawCalendarWeek = getPlanWeekForDate(today, scheduleAnchor);
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
  const weekTargetKm = currentPlanWeek ? getWeeklyTargetKm(currentPlanWeek) : 0;
  const weekActualKm = weekActivities.reduce((s, a) => s + a.distanceKm, 0);
  const weekPlanned = currentPlanWeek?.sessions.length ?? 0;
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
      week: `W${wn}`,
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

  // ── Upcoming: next 5 Wed/Sat/Sun plan sessions (no completed days) ───────
  type UpcomingRow = {
    session: (typeof planToRender)[0]["sessions"][0];
    date: Date;
    week: number;
  };
  const upcomingCandidates: UpcomingRow[] = [];
  for (let w = currentWeek; w <= lastPlanWeekNum; w++) {
    const pw = planToRender.find((x) => x.week === w);
    if (!pw) continue;
    for (const day of ["wed", "sat", "sun"] as Day[]) {
      const session = pw.sessions.find((s) => s.day === day);
      if (!session) continue;
      const date = getSessionDate(w, session.day, scheduleAnchor);
      if (date <= todayAESTMidnight) continue;
      if (hasRunOnCalendarDay(runsPlanForward, date)) continue;
      upcomingCandidates.push({ session, date, week: w });
    }
  }
  upcomingCandidates.sort((a, b) => a.date.getTime() - b.date.getTime());
  const upcomingSessions = upcomingCandidates.slice(0, 5);

  // ── Sidebar checklist: same week + sessions as Program page (planToRender) ─
  const CHECKLIST_DAY_ORDER: Day[] = ["wed", "sat", "sun"];
  const DAY_LABEL: Record<Day, string> = { wed: "Wed", sat: "Sat", sun: "Sun" };
  const sessionChecklist = [...(currentPlanWeek?.sessions ?? [])]
    .filter((s) => CHECKLIST_DAY_ORDER.includes(s.day))
    .sort((a, b) => CHECKLIST_DAY_ORDER.indexOf(a.day) - CHECKLIST_DAY_ORDER.indexOf(b.day))
    .map((session) => {
      const date = getSessionDate(currentWeek, session.day, scheduleAnchor);
      const completed = weekActivities.some((a) => {
        const d = new Date(a.date);
        return sameDayAEST(d, date) && isActivityOnOrAfterPlanStart(d, planStart);
      });
      return { session, date, completed, future: date > todayAESTMidnight, dayLabel: DAY_LABEL[session.day] };
    });

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
  const nextPhase = getNextPhaseInfo(currentPhase);

  // ── Sync timestamps (Strava) ──────────────────────────────────────────────
  const lastSyncedAt = lastSyncRow?.syncedAt?.toISOString() ?? null;
  const lastRunImportedLabel = lastSyncRow?.syncedAt
    ? formatDistanceToNowAEST(lastSyncRow.syncedAt, { addSuffix: true })
    : "never";
  const lastRefreshedLabel = profile?.lastRefreshedAt
    ? formatDistanceToNowAEST(profile.lastRefreshedAt, { addSuffix: true })
    : "Never refreshed";

  const todayPlanEntry = sessionChecklist.find((row) => sameDayAEST(row.date, today));

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
            {oauthDetail && (
              <p className="mt-1 font-mono text-xs break-all" style={{ color: "#fca5a5" }}>
                {oauthDetail}
              </p>
            )}
          </div>
        )}

        {/* Logo icon + phase header */}
        <Logo size="md" showWordmark={false} />

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 min-w-0">
            <span className="text-lg sm:text-xl md:text-2xl font-bold text-white shrink-0">Dashboard</span>
            <span
              className="text-xs font-semibold px-2.5 py-1 rounded-full shrink-0"
              style={phaseStyle(currentPhase)}
            >
              Week {currentWeek} · {currentPhase}
            </span>
          </div>
          <p className="text-xs w-full sm:w-auto" style={{ color: "var(--text-muted)" }}>
            {formatAEST(today, "EEEE, d MMMM yyyy")}
          </p>
        </div>

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
                  <span
                    className="text-xs px-2 py-0.5 rounded-full font-medium capitalize"
                    style={runTypePillStyle(todayPlanEntry.session.type)}
                  >
                    {todayPlanEntry.session.type}
                  </span>
                  {todayPlanEntry.completed && (
                    <span className="text-xs font-medium text-green-400">Done</span>
                  )}
                </div>
                <p className="text-sm text-white">
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
                / {weekTargetKm.toFixed(0)} km
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
                const pill = runTypePillStyle(run.runType);
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
                          <span className="text-xs px-2 py-0.5 rounded-full font-medium shrink-0 capitalize" style={pill}>
                            {run.runType}
                          </span>
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
                        <p className="text-white font-medium tabular-nums">{formatPace(run.avgPaceSecKm)}</p>
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
                const pill = runTypePillStyle(s.type);
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
                        {formatAEST(row.date, "EEE")}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-white font-semibold text-sm capitalize">{s.type}</span>
                          <span className="text-xs px-2 py-0.5 rounded-full font-medium shrink-0 capitalize" style={pill}>
                            {s.type}
                          </span>
                        </div>
                        <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                          {formatAEST(row.date, "EEE d MMM yyyy")}
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-xs sm:flex sm:gap-4 sm:ml-auto sm:text-right">
                      <div>
                        <p className="text-white font-medium">{s.targetDistanceKm} km</p>
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

        {/* This week panel */}
        <Card className="p-4">
          <SectionLabel>This Week</SectionLabel>
          <p className="text-sm font-semibold text-white mt-2 mb-1">
            Week {currentWeek} · {currentPhase}
          </p>

          {/* Progress bar */}
          <div className="flex justify-between text-xs mb-1">
            <span style={{ color: "var(--text-muted)" }}>{weekActualKm.toFixed(1)} km</span>
            <span style={{ color: "var(--text-muted)" }}>{weekTargetKm} km</span>
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
            {sessionChecklist.map(({ session, date, completed, future, dayLabel }) => (
              <div key={session.day} className="flex items-start gap-2.5">
                <div
                  className="w-4 h-4 rounded mt-0.5 flex items-center justify-center text-xs flex-shrink-0"
                  style={{
                    background: completed
                      ? "var(--accent)"
                      : "rgba(255,255,255,0.08)",
                    color: completed ? "#fff" : "transparent",
                  }}
                >
                  {completed ? "✓" : ""}
                </div>
                <div className="flex-1 min-w-0">
                  <p
                    className="text-xs font-medium leading-tight capitalize"
                    style={{ color: completed ? "var(--text-muted)" : "white" }}
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
            Week {currentWeek - phaseStart + 1} of {phaseEnd - phaseStart + 1}
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
          {nextPhase ? (
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              {nextPhase.label} starts Week {nextPhase.week}
            </p>
          ) : (
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Race week is here 🏁
            </p>
          )}
        </Card>

        {/* Plan start reference */}
        <p className="text-xs px-1" style={{ color: "rgba(156,163,175,0.4)" }}>
          Plan starts {formatAEST(planStart, "d MMM yyyy")}
        </p>

      </aside>
    </div>
  );
}
