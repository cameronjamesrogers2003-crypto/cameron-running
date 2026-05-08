import prisma from "@/lib/db";
import { buildTrainingPlan } from "@/data/trainingPlan";
import { loadGeneratedPlan } from "@/lib/planStorage";
import { inferRunType } from "@/lib/rating";
import { dbSettingsToUserSettings, DEFAULT_SETTINGS } from "@/lib/settings";
import { getEffectivePlanStart, getSessionDate, isPlannedRun } from "@/lib/planUtils";
import { brisbaneCalendarYearUtcRange, startOfBrisbaneMonthContaining, startOfDayAEST, startOfNextDayAEST, toBrisbaneYmd } from "@/lib/dateUtils";
import type { CalendarRun, CalendarData, PlannedDayMeta } from "./types";
import CalendarGrid from "./CalendarGrid";

export const dynamic = "force-dynamic";
export const metadata = { title: "Runshift — Calendar" };

function calculateInjuryFreeWeeks(
  activities: Array<{ date: Date }>,
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
        done: activities.some((activity) => toBrisbaneYmd(activity.date) === toBrisbaneYmd(sessionDate)),
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

  const streakSessions = breakAtWeek === 0 ? sessions : sessions.filter((session) => session.weekNum > breakAtWeek);
  return new Set(streakSessions.map((session) => session.weekNum)).size;
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const today = new Date();
  const defaultYear = parseInt(toBrisbaneYmd(today).slice(0, 4), 10);
  const year = parseInt(params.year as string) || defaultYear;
  const { start: yearStart, endExclusive: yearEnd } = brisbaneCalendarYearUtcRange(year);
  const statsStart = new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000);

  const [userSettingsRow, yearActivities, statsActivities, storedGenerated] = await Promise.all([
    prisma.userSettings.findUnique({ where: { id: 1 } }),
    prisma.activity.findMany({
      where: { activityType: { in: ["running", "trail_running"] }, date: { gte: yearStart, lt: yearEnd } },
      orderBy: { date: "asc" },
    }),
    prisma.activity.findMany({
      where: { activityType: { in: ["running", "trail_running"] }, date: { gte: statsStart, lt: startOfNextDayAEST(today) } },
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
        classificationMethod: true,
        activityType: true,
      },
    }),
    loadGeneratedPlan(),
  ]);

  const settings = userSettingsRow ? dbSettingsToUserSettings(userSettingsRow) : DEFAULT_SETTINGS;
  const planStart = getEffectivePlanStart(settings.planStartDate);
  const plan = storedGenerated?.plan?.length ? storedGenerated.plan : buildTrainingPlan(settings);
  const injuryFreeWeeks = calculateInjuryFreeWeeks(statsActivities, plan, planStart, today);

  const todayMidnight = startOfDayAEST(today);
  const todayEnd = startOfNextDayAEST(today);
  const MS = 24 * 60 * 60 * 1000;
  const past28 = new Date(todayMidnight.getTime() - 28 * MS);
  const past42 = new Date(todayMidnight.getTime() - 42 * MS);
  const monthStart = startOfBrisbaneMonthContaining(today);
  const aestKey = toBrisbaneYmd;

  const extraRunsThisMonth = statsActivities.filter((r) => {
    const d = new Date(r.date);
    if (d < monthStart || d >= todayEnd) return false;
    return !isPlannedRun(d, plan, planStart);
  }).length;

  let longPlanned = 0;
  let longDone = 0;
  const statsKeys = new Set(statsActivities.map((r) => aestKey(new Date(r.date))));
  for (const pw of plan) {
    const ls = pw.sessions.find((s) => s.type === "long");
    if (!ls) continue;
    const sd = getSessionDate(pw.week, ls.day, planStart);
    if (sd >= todayEnd || sd < past42) continue;
    longPlanned++;
    if (statsKeys.has(aestKey(sd))) longDone++;
  }

  let sessPlanned = 0;
  let sessDone = 0;
  for (const pw of plan) {
    for (const sess of pw.sessions) {
      const sd = getSessionDate(pw.week, sess.day, planStart);
      if (sd < monthStart || sd >= todayEnd) continue;
      sessPlanned++;
      if (statsKeys.has(aestKey(sd))) sessDone++;
    }
  }

  const runsLast28 = statsActivities.filter((r) => new Date(r.date) >= past28 && new Date(r.date) < todayEnd);
  const ratings28 = runsLast28.map((r) => r.rating).filter((v): v is number => v != null && !Number.isNaN(v));
  const avgRating28 = ratings28.length > 0 ? Math.round((ratings28.reduce((s, r) => s + r, 0) / ratings28.length) * 10) / 10 : null;

  const calendarData: CalendarData = {};
  for (const act of yearActivities) {
    const dateKey = toBrisbaneYmd(act.date);
    if (!calendarData[dateKey]) calendarData[dateKey] = [];
    const runType = inferRunType(act, settings);
    const rating = act.rating != null && !Number.isNaN(act.rating) ? act.rating : null;
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
      ratingBreakdown: act.ratingBreakdown ?? null,
      classificationMethod: act.classificationMethod ?? null,
      runType,
      isPlanned: isPlannedRun(new Date(act.date), plan, planStart),
    };
    calendarData[dateKey].push(run);
  }

  const plannedDayMeta: PlannedDayMeta = {};
  const yearRunKeys = new Set(yearActivities.map((a) => toBrisbaneYmd(a.date)));
  for (const planWeek of plan) {
    for (const session of planWeek.sessions) {
      const sessionDate = getSessionDate(planWeek.week, session.day, planStart);
      const sessionKey = toBrisbaneYmd(sessionDate);
      if (!sessionKey.startsWith(`${year}-`)) continue;
      if (yearRunKeys.has(sessionKey)) continue;
      plannedDayMeta[sessionKey] = {
        kind: sessionDate >= todayEnd ? "planned" : "missed",
        runType: session.type,
      };
    }
  }

  const todayKey = toBrisbaneYmd(today);

  return (
    <div className="calendar-shell max-w-[1100px] mx-auto w-full">
      <div className="flex items-start justify-between mb-6 pt-2">
        <div>
          <p className="text-sm font-medium mb-1" style={{ color: "var(--text-muted)" }}>
            Your training history
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-white">Calendar</h1>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
        {[
          { label: "STREAK", value: `${injuryFreeWeeks} wks` },
          { label: "SESSIONS", value: `${sessDone}/${sessPlanned}` },
          { label: "LONG RUNS", value: `${longDone}/${longPlanned}` },
          { label: "EXTRAS", value: String(extraRunsThisMonth) },
          { label: "AVG RATING", value: avgRating28 != null ? `${avgRating28}/10` : "—", isRating: true },
        ].map((item) => (
          <div key={item.label} className="rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-3 flex flex-col gap-0.5">
            <p className="text-xs font-semibold tracking-widest uppercase" style={{ color: "var(--text-label)" }}>
              {item.label}
            </p>
            <p
              className="text-lg font-black font-mono tabular-nums text-white"
              style={
                item.isRating && avgRating28 != null
                  ? { color: avgRating28 >= 9.0 ? "#a78bfa" : avgRating28 >= 7.0 ? "#4ade80" : avgRating28 >= 5.5 ? "var(--accent)" : avgRating28 >= 4.0 ? "#f5b454" : "#f87171" }
                  : undefined
              }
            >
              {item.value}
            </p>
          </div>
        ))}
      </div>

      <CalendarGrid year={year} todayKey={todayKey} calendarData={calendarData} plannedDayMeta={plannedDayMeta} />
    </div>
  );
}
