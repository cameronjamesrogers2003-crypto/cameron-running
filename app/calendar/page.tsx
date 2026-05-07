import prisma from "@/lib/db";
import { buildTrainingPlan, type TrainingWeek } from "@/data/trainingPlan";
import { loadGeneratedPlan } from "@/lib/planStorage";
import { inferRunType, type StatActivity } from "@/lib/rating";
import {
  PLAYER_RATING_ATTRIBUTES,
  playerRatingAccent,
  ratingConditionsScore,
  type PlayerRatingAttribute,
  type PlayerRatingLike,
} from "@/lib/playerRating";
import { dbSettingsToUserSettings, DEFAULT_SETTINGS, formatPace, type UserSettings } from "@/lib/settings";
import {
  getEffectivePlanStart,
  getPlanWeekForDate,
  getSessionDate,
  isActivityOnOrAfterPlanStart,
  isPlannedRun,
} from "@/lib/planUtils";
import {
  brisbaneCalendarYearUtcRange,
  formatAEST,
  startOfBrisbaneMonthContaining,
  startOfDayAEST,
  startOfNextDayAEST,
  toAEST,
  toBrisbaneYmd,
} from "@/lib/dateUtils";
import type { CalendarRun, CalendarData } from "./types";
import CalendarGrid from "./CalendarGrid";
import Logo from "@/components/Logo";

export const dynamic = "force-dynamic";

// ── Player card helpers ───────────────────────────────────────────────────────

type CalendarRatingActivity = StatActivity & {
  activityType: string;
  ratingBreakdown?: string | null;
};

type AttributeExplanationKey = Exclude<PlayerRatingAttribute, "overall">;

function playerRatingValue(rating: PlayerRatingLike, key: AttributeExplanationKey): number {
  return Math.round(rating[key]);
}

function formatKm(value: number): string {
  return `${Math.round(value * 10) / 10} km`;
}

function calculateInjuryFreeWeeks(
  activities: CalendarRatingActivity[],
  plan: ReturnType<typeof buildTrainingPlan>,
  planStart: Date,
  today: Date,
): number {
  const todayMidnight = startOfDayAEST(today);
  const dayOrder: Record<string, number> = { mon: 0, tue: 1, wed: 2, thu: 3, fri: 4, sat: 5, sun: 6 };
  const sessions: Array<{ weekNum: number; done: boolean }> = [];

  for (const planWeek of plan) {
    const sorted = [...planWeek.sessions].sort((a, b) => dayOrder[a.day] - dayOrder[b.day]);
    for (const session of sorted) {
      const sessionDate = getSessionDate(planWeek.week, session.day, planStart);
      if (sessionDate >= todayMidnight) continue;

      sessions.push({
        weekNum: planWeek.week,
        done: activities.some((activity) => {
          const activityDate = new Date(activity.date);
          return (
            isActivityOnOrAfterPlanStart(activityDate, planStart)
            && toBrisbaneYmd(activityDate) === toBrisbaneYmd(sessionDate)
          );
        }),
      });
    }
  }

  let breakAtWeek = 0;
  for (let i = sessions.length - 1; i > 0; i--) {
    if (!sessions[i].done && !sessions[i - 1].done) {
      breakAtWeek = sessions[i].weekNum;
      break;
    }
  }

  const streakSessions =
    breakAtWeek === 0 ? sessions : sessions.filter((session) => session.weekNum > breakAtWeek);
  return new Set(streakSessions.map((session) => session.weekNum)).size;
}

function playerAttributeExplanation(
  key: AttributeExplanationKey,
  activities: CalendarRatingActivity[],
  plan: TrainingWeek[],
  settings: UserSettings,
  planStart: Date,
  today: Date,
): string {
  const todayEnd = startOfNextDayAEST(today);
  const last30 = new Date(todayEnd.getTime() - 30 * 24 * 60 * 60 * 1000);
  const last28 = new Date(todayEnd.getTime() - 28 * 24 * 60 * 60 * 1000);
  const recent30 = activities.filter((a) => {
    const d = new Date(a.date);
    return d >= last30 && d < todayEnd;
  });

  if (key === "speed") {
    const speedRuns = recent30
      .filter((a) => a.avgPaceSecKm > 0 && ["tempo", "interval"].includes(inferRunType(a, settings)))
      .sort((a, b) => a.avgPaceSecKm - b.avgPaceSecKm);
    const best = speedRuns[0];
    if (!best) {
      return "No tempo or interval runs found in the last 30 days. Add a faster workout to give SPD fresh data.";
    }
    return `Your best tempo/interval pace in the last 30 days is ${formatPace(best.avgPaceSecKm)}/km. Run faster intervals to push this up.`;
  }

  if (key === "endurance") {
    const recent28 = activities.filter((a) => {
      const d = new Date(a.date);
      return d >= last28 && d < todayEnd;
    });
    const longestRun = recent30.reduce((max, a) => Math.max(max, a.distanceKm), 0);
    const avgWeeklyKm = recent28.reduce((sum, a) => sum + a.distanceKm, 0) / 4;
    if (recent30.length === 0) {
      return "No runs found in the last 30 days, so endurance has no recent distance data. Build your long run distance to improve this.";
    }
    return `Your longest run is ${formatKm(longestRun)} and weekly average is ${formatKm(avgWeeklyKm)}. Build your long run distance to improve this.`;
  }

  if (key === "consistency") {
    const planStartLabel = formatAEST(planStart, "d MMM");
    let hits = 0;
    const currentWeek = Math.max(1, getPlanWeekForDate(today, planStart));
    const firstWeek = Math.max(1, currentWeek - 3);
    const runKeys = new Set(
      activities
        .filter((a) => isActivityOnOrAfterPlanStart(new Date(a.date), planStart))
        .map((a) => toBrisbaneYmd(a.date)),
    );
    const planSessions: Date[] = [];
    for (let week = firstWeek; week <= currentWeek; week++) {
      const planWeek = plan.find((w) => w.week === week);
      if (!planWeek) continue;
      for (const session of planWeek.sessions) {
        const sessionDate = getSessionDate(week, session.day, planStart);
        planSessions.push(sessionDate);
        if (runKeys.has(toBrisbaneYmd(sessionDate))) hits++;
      }
    }
    const plannedCount = planSessions.length;
    if (hits === 0) {
      return `No scheduled sessions completed yet; plan starts ${planStartLabel}. Hit your sessions every week to climb this.`;
    }
    return `You have completed ${hits}/${plannedCount} scheduled sessions in the last 4 weeks. Hit your sessions every week to climb this.`;
  }

  if (key === "hrEfficiency") {
    const easyHrRuns = recent30.filter((a) =>
      a.avgPaceSecKm > 0
      && (a.avgHeartRate ?? 0) > 0
      && inferRunType(a, settings) === "easy"
    );
    if (easyHrRuns.length === 0) {
      return "No HR data on easy runs found in the last 30 days. Run more easy runs with your HR monitor to improve this score.";
    }
    const avgPace = Math.round(easyHrRuns.reduce((sum, a) => sum + a.avgPaceSecKm, 0) / easyHrRuns.length);
    const avgHr = Math.round(easyHrRuns.reduce((sum, a) => sum + (a.avgHeartRate ?? 0), 0) / easyHrRuns.length);
    return `Based on ${easyHrRuns.length} easy HR ${easyHrRuns.length === 1 ? "run" : "runs"} averaging ${formatPace(avgPace)}/km at ${avgHr} bpm. Run more easy runs with your HR monitor to improve this score.`;
  }

  const conditionRuns = recent30;
  if (conditionRuns.length === 0) {
    return "No runs found in the last 30 days, so toughness has no recent conditions data. Keep logging runs with weather data to improve this.";
  }
  const avgConditions =
    conditionRuns.reduce((sum, a) => sum + ratingConditionsScore(a.ratingBreakdown), 0) / conditionRuns.length;
  return `Your average conditions score is ${avgConditions.toFixed(2)} across ${conditionRuns.length} recent ${conditionRuns.length === 1 ? "run" : "runs"}. Brisbane summer will push this up naturally.`;
}

function PlayerCard({
  rating,
  activities,
  plan,
  settings,
  planStart,
  today,
}: {
  rating: PlayerRatingLike | null;
  activities: CalendarRatingActivity[];
  plan: TrainingWeek[];
  settings: UserSettings;
  planStart: Date;
  today: Date;
}) {
  if (!rating) {
    return (
      <div
        className="rounded-[10px] p-5 md:col-span-2"
        style={{ background: "#181818", border: "1px solid rgba(255,255,255,0.08)" }}
      >
        <div className="rounded-2xl p-5 text-center" style={{ background: "#0b1020" }}>
          <p className="text-5xl font-black text-white tabular-nums">--</p>
          <p className="text-xs uppercase tracking-[0.3em] font-bold" style={{ color: "var(--text-muted)" }}>
            OVR
          </p>
          <p className="text-sm mt-4" style={{ color: "var(--text-muted)" }}>
            Visit /api/player-rating/initialize after deployment to seed your first rating.
          </p>
        </div>
      </div>
    );
  }

  const overall = Math.round(rating.overall);
  const accent = playerRatingAccent(overall);

  return (
    <div
      className="rounded-[10px] p-4 sm:p-5 overflow-hidden md:col-span-2"
      style={{ background: "#181818", border: "1px solid rgba(255,255,255,0.08)" }}
    >
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
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-start">
          <div className="flex items-center gap-4 lg:w-48 lg:flex-col lg:items-start">
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

          <div className="grid flex-1 gap-4">
            {PLAYER_RATING_ATTRIBUTES.map((attr) => {
              const value = playerRatingValue(rating, attr.key);
              const width = Math.min(100, Math.max(0, (value / 99) * 100));
              const barColor = playerRatingAccent(value);
              return (
                <div key={attr.key} className="grid gap-1.5">
                  <div className="grid grid-cols-[42px_1fr_34px] items-center gap-3">
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
                  <p className="pl-[55px] text-[11px] leading-snug" style={{ color: "rgba(255,255,255,0.55)" }}>
                    {playerAttributeExplanation(attr.key, activities, plan, settings, planStart, today)}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── page ──────────────────────────────────────────────────────────────────────

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params       = await searchParams;
  const today       = new Date();
  const defaultYear = parseInt(toBrisbaneYmd(today).slice(0, 4), 10);
  const year         = parseInt(params.year as string) || defaultYear;

  const { start: yearStart, endExclusive: yearEnd } = brisbaneCalendarYearUtcRange(year);

  // Stats always use the last 90 days regardless of displayed year
  const statsStart = new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000);

  const [userSettingsRow, yearActivities, statsActivities, playerRating, storedGenerated] = await Promise.all([
    prisma.userSettings.findUnique({ where: { id: 1 } }),
    prisma.activity.findMany({
      where: {
        activityType: { in: ["running", "trail_running"] },
        date: { gte: yearStart, lt: yearEnd },
      },
      orderBy: { date: "asc" },
    }),
    prisma.activity.findMany({
      where: {
        activityType: { in: ["running", "trail_running"] },
        date: { gte: statsStart, lt: startOfNextDayAEST(today) },
      },
      orderBy: { date: "asc" },
      select: {
        id: true,
        date: true,
        distanceKm: true,
        avgPaceSecKm: true,
        avgHeartRate: true,
        maxHeartRate: true,
        rating: true,
        ratingBreakdown: true,
        classifiedRunType: true,
        activityType: true,
      },
    }),
    prisma.playerRating.findFirst({ orderBy: { updatedAt: "desc" } }),
    loadGeneratedPlan(),
  ]);

  const settings    = userSettingsRow ? dbSettingsToUserSettings(userSettingsRow) : DEFAULT_SETTINGS;
  const planStart     = getEffectivePlanStart(settings.planStartDate);
  const plan = storedGenerated?.plan?.length ? storedGenerated.plan : buildTrainingPlan(settings);
  const injuryFreeWeeks = calculateInjuryFreeWeeks(statsActivities, plan, planStart, today);

  // Derive stats strip values (Brisbane calendar day bounds)
  const todayMidnight = startOfDayAEST(today);
  const todayEnd      = startOfNextDayAEST(today);
  const MS            = 24 * 60 * 60 * 1000;
  const past28        = new Date(todayMidnight.getTime() - 28 * MS);
  const past42        = new Date(todayMidnight.getTime() - 42 * MS);
  const monthStart = startOfBrisbaneMonthContaining(today);

  const aestKey = toBrisbaneYmd;

  // Extra runs this month
  const extraRunsThisMonth = statsActivities.filter((r) => {
    const d = new Date(r.date);
    if (d < monthStart || d >= todayEnd) return false;
    return !isPlannedRun(d, plan, planStart);
  }).length;

  // Long runs: last 6 weeks
  let longPlanned = 0;
  let longDone    = 0;
  const statsKeys = new Set(statsActivities.map((r) => aestKey(new Date(r.date))));

  for (const pw of plan) {
    const ls = pw.sessions.find((s) => s.type === "long");
    if (!ls) continue;
    const sd = getSessionDate(pw.week, ls.day, planStart);
    if (sd >= todayEnd || sd < past42) continue;
    longPlanned++;
    if (statsKeys.has(aestKey(sd))) longDone++;
  }

  // All plan sessions this month
  let sessPlanned = 0;
  let sessDone    = 0;
  for (const pw of plan) {
    for (const sess of pw.sessions) {
      const sd = getSessionDate(pw.week, sess.day, planStart);
      if (sd < monthStart || sd >= todayEnd) continue;
      sessPlanned++;
      if (statsKeys.has(aestKey(sd))) sessDone++;
    }
  }

  // Avg rating last 4 weeks
  const runsLast28 = statsActivities.filter((r) => new Date(r.date) >= past28 && new Date(r.date) < todayEnd);
  const ratings28 = runsLast28
    .map((r) => r.rating)
    .filter((v): v is number => v != null && !Number.isNaN(v));
  const avgRating28 = ratings28.length > 0
    ? Math.round((ratings28.reduce((s, r) => s + r, 0) / ratings28.length) * 10) / 10
    : null;

  // ── Build calendar data map ──────────────────────────────────────────────
  const calendarData: CalendarData = {};

  for (const act of yearActivities) {
    const dateKey = toBrisbaneYmd(act.date);
    if (!calendarData[dateKey]) calendarData[dateKey] = [];

    const runType = inferRunType(act, settings);
    const rating  = act.rating != null && !Number.isNaN(act.rating) ? act.rating : null;

    const run: CalendarRun = {
      id: act.id,
      name: act.name,
      dateIso: act.date.toISOString(),
      distanceKm: act.distanceKm,
      durationSecs: act.durationSecs,
      avgPaceSecKm: act.avgPaceSecKm,
      avgHeartRate: act.avgHeartRate,
      maxHeartRate: act.maxHeartRate,
      calories: act.calories,
      elevationGainM: act.elevationGainM,
      temperatureC: act.temperatureC,
      humidityPct: act.humidityPct,
      activityType: act.activityType,
      rating,
      runType,
      isPlanned: isPlannedRun(new Date(act.date), plan, planStart),
    };

    calendarData[dateKey].push(run);
  }

  // ── Render ────────────────────────────────────────────────────────────────
  const todayKey = toBrisbaneYmd(today);

  return (
    <div className="space-y-5">
      {/* ── Page header ──────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        <Logo size="sm" showWordmark={false} />
        <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-white">Calendar</h1>
      </div>

      {/* ── Top strip ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <PlayerCard
          rating={playerRating}
          activities={statsActivities}
          plan={plan}
          settings={settings}
          planStart={planStart}
          today={today}
        />

        {/* Panel 3: Stats strip */}
        <div
          className="rounded-[10px] p-4"
          style={{ background: "#181818", border: "1px solid rgba(255,255,255,0.08)" }}
        >
          <p className="text-xs uppercase tracking-wider mb-3" style={{ color: "var(--text-muted)" }}>
            Stats
          </p>
          <div className="space-y-3">
            {[
              { label: "Injury-free streak",     value: `${injuryFreeWeeks} wks` },
              { label: "Extra runs this month",   value: String(extraRunsThisMonth) },
              { label: "Long runs (last 6 wks)",  value: `${longDone}/${longPlanned}` },
              { label: "Sessions this month",     value: `${sessDone}/${sessPlanned}` },
              { label: "Avg rating (last 4 wks)", value: avgRating28 != null ? `${avgRating28}/10` : "—" },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between">
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                  {label}
                </span>
                <span className="text-sm font-semibold text-white">{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Calendar grid (client) ───────────────────────────────────────── */}
      <CalendarGrid year={year} todayKey={todayKey} calendarData={calendarData} />
    </div>
  );
}
