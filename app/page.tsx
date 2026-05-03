import { format } from "date-fns";
import prisma from "@/lib/db";
import { plans, getCurrentPlanWeek, getTodayWorkout, getNextTrainingWorkout, getWeeklyPlanKm, type PlanId } from "@/lib/plans";
import { getBrisbaneWeather, getBestRunTime, getSeasonalTip } from "@/lib/weather";
import StatsBar from "@/components/StatsBar";
import WeeklyChart from "@/components/WeeklyChart";
import RecentRunsFeed from "@/components/RecentRunsFeed";
import TodayWorkout from "@/components/TodayWorkout";
import WeatherWidget from "@/components/WeatherWidget";
import SyncButton from "@/components/SyncButton";
import RatingSparkline from "@/components/RatingSparkline";

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function isBirthday(dob: Date): boolean {
  const today = new Date();
  return today.getMonth() === dob.getMonth() && today.getDate() === dob.getDate();
}

function getMotivationalLine(week: number, totalWeeks: number): string {
  if (week <= 0) return "Start your plan by setting a start date on the Program page.";
  if (week > totalWeeks) return "You've completed the training plan — race week is here!";
  const pct = Math.round((week / totalWeeks) * 100);
  if (week === 1) return `Week 1 of ${totalWeeks} — the first step is always the hardest. Let's go.`;
  if (pct <= 33) return `Week ${week} of ${totalWeeks} — early days, build the habit.`;
  if (pct <= 50) return `Week ${week} of ${totalWeeks} — you're one third of the way there.`;
  if (pct <= 66) return `Week ${week} of ${totalWeeks} — halfway done, momentum is building.`;
  if (pct <= 80) return `Week ${week} of ${totalWeeks} — the hard work is behind you. Taper soon.`;
  return `Week ${week} of ${totalWeeks} — race day is close. Trust your training.`;
}

function getPlanPhase(week: number, totalWeeks: number): "base" | "build" | "peak" | "taper" {
  const pct = week / totalWeeks;
  if (pct <= 0.33) return "base";
  if (pct <= 0.66) return "build";
  if (pct <= 0.83) return "peak";
  return "taper";
}

export const dynamic = "force-dynamic";

export default async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const params = await searchParams;
  const oauthError = params.error;
  const oauthDetail = params.detail;
  const [profile, settings, recentActivities, allActivities, weather, recentRatings] =
    await Promise.all([
      prisma.profile.findUnique({ where: { id: 1 } }),
      prisma.settings.findUnique({ where: { id: 1 } }),
      prisma.activity.findMany({ orderBy: { date: "desc" }, take: 10 }),
      prisma.activity.findMany({ where: { activityType: { in: ["running", "trail_running"] } } }),
      getBrisbaneWeather(),
      prisma.runRating.findMany({
        orderBy: { createdAt: "desc" },
        take: 28,
        include: { activity: { select: { date: true, distanceKm: true } } },
      }),
    ]);

  const planId: PlanId = (settings?.activePlan as PlanId) ?? "half";
  const plan = plans[planId];
  const totalWeeks = plan.length;
  const planStartDate = settings?.planStartDate ? new Date(settings.planStartDate) : null;

  const today = new Date();
  const currentWeek = planStartDate ? getCurrentPlanWeek(planStartDate, today) : 0;
  const todayData = planStartDate ? getTodayWorkout(plan, planStartDate, today) : null;
  const nextWorkout = planStartDate ? getNextTrainingWorkout(plan, planStartDate, today) : null;

  const name = profile?.name ?? "Cameron";
  const dob = profile?.dateOfBirth ? new Date(profile.dateOfBirth) : new Date("2002-08-16");
  const birthday = isBirthday(dob);
  const age = today.getFullYear() - dob.getFullYear();

  const totalRunKm = allActivities.reduce((s, a) => s + a.distanceKm, 0);
  const longestRun = allActivities.reduce((m, a) => Math.max(m, a.distanceKm), 0);

  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - today.getDay() + 1);
  weekStart.setHours(0, 0, 0, 0);
  const thisWeekKm = allActivities
    .filter((a) => new Date(a.date) >= weekStart)
    .reduce((s, a) => s + a.distanceKm, 0);

  const stats = [
    {
      label: "Total Runs",
      value: String(allActivities.length),
      sub: allActivities.length === 1 ? "activity" : "activities",
    },
    {
      label: "This Week",
      value: `${thisWeekKm.toFixed(1)} km`,
      sub: format(weekStart, "d MMM") + " onwards",
    },
    {
      label: "Plan Week",
      value: currentWeek > 0 && currentWeek <= totalWeeks ? `${currentWeek} / ${totalWeeks}` : "—",
      sub: currentWeek > 0 ? "current week" : "not started",
    },
    {
      label: "Longest Run",
      value: longestRun > 0 ? `${longestRun.toFixed(2)} km` : "—",
      sub: "personal best",
    },
  ];

  const chartData = plan.map((w) => ({
    week: w.week,
    km: getWeeklyPlanKm(w),
    current: w.week === currentWeek,
    phase: getPlanPhase(w.week, totalWeeks),
  }));

  const onTrack =
    todayData?.workout.type === "rest"
      ? "rest"
      : allActivities.some((a) => {
          const d = new Date(a.date);
          d.setHours(0, 0, 0, 0);
          const t = new Date(today);
          t.setHours(0, 0, 0, 0);
          return d.getTime() === t.getTime();
        })
      ? "on_track"
      : "behind";

  const bestRunTime = getBestRunTime(weather?.hourlyTemps, weather?.hourlyTimes);
  const monthTip = getSeasonalTip(today.getMonth() + 1);
  const planLabel = planId === "half" ? "Half Marathon Novice" : "Marathon Novice 1";

  const lastActivity = recentActivities[0];

  // Ratings sparkline data
  const sparklineRatings = recentRatings
    .map(r => ({ date: r.activity.date.toISOString().split("T")[0], score: Number(r.score) }))
    .reverse();

  const weekAgo = new Date(today);
  weekAgo.setDate(today.getDate() - 7);
  const thisWeekRatings = recentRatings.filter(r => new Date(r.activity.date) >= weekAgo);
  const bestThisWeek = thisWeekRatings.length > 0
    ? thisWeekRatings.reduce((best, r) =>
        Number(r.score) > Number(best.score) ? r : best
      )
    : null;

  const avg4wkRatings = recentRatings.slice(0, 28);
  const avg4wk = avg4wkRatings.length > 0
    ? Math.round(
        avg4wkRatings.reduce((s, r) => s + Number(r.score), 0) / avg4wkRatings.length * 10
      ) / 10
    : null;

  return (
    <div className="space-y-5">
      {/* OAuth error banner — shows the exact Strava error in the browser */}
      {oauthError && (
        <div
          className="rounded-xl px-4 py-3 text-sm"
          style={{ background: "#2d1515", border: "1px solid #7f1d1d" }}
        >
          <p className="font-semibold text-red-400">
            {oauthError === "strava_denied" ? "Strava authorisation denied" : "Strava connection failed"}
          </p>
          {oauthDetail && (
            <p className="mt-1 font-mono text-xs break-all" style={{ color: "#fca5a5" }}>
              {oauthDetail}
            </p>
          )}
          <p className="mt-2 text-xs" style={{ color: "#9ca3af" }}>
            Copy the error above and check your Strava app settings at strava.com/settings/api.
          </p>
        </div>
      )}

      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-bold text-white">
          {birthday
            ? `Happy birthday, ${name} 🎂`
            : `${getGreeting()}, ${name} 👋`}
        </h1>
        <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
          {birthday
            ? `What a way to spend your ${age + 1}th — ${getMotivationalLine(currentWeek, totalWeeks)}`
            : getMotivationalLine(currentWeek, totalWeeks)}
        </p>
      </div>

      {/* Stats bar */}
      <StatsBar stats={stats} />

      {/* Today + Weather row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <TodayWorkout
          workout={todayData?.workout ?? null}
          week={currentWeek > 0 ? currentWeek : 1}
          totalWeeks={totalWeeks}
          planName={planLabel}
          bestRunTime={bestRunTime}
          onTrack={onTrack as "on_track" | "behind" | "rest"}
          nextWorkout={nextWorkout}
        />
        <div className="flex flex-col gap-3">
          <WeatherWidget weather={weather} />
          <div
            className="rounded-xl px-4 py-3 text-sm"
            style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-muted)" }}
          >
            <span className="font-semibold text-white">Seasonal tip: </span>
            {monthTip}
          </div>
        </div>
      </div>

      {/* Run ratings sparkline */}
      {sparklineRatings.length > 0 && (
        <RatingSparkline
          ratings={sparklineRatings}
          avg4wk={avg4wk}
          bestThisWeek={
            bestThisWeek
              ? {
                  score: Number(bestThisWeek.score),
                  distanceKm: bestThisWeek.activity.distanceKm,
                }
              : null
          }
        />
      )}

      {/* Weekly chart */}
      <WeeklyChart data={chartData} />

      {/* Sync + Recent runs */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
          Recent Runs
        </h2>
        <SyncButton
          lastSynced={lastActivity?.syncedAt ?? null}
          stravaConnected={profile?.stravaConnected ?? false}
        />
      </div>

      <RecentRunsFeed
        runs={recentActivities.map((a) => ({
          id: a.id,
          date: a.date,
          distanceKm: a.distanceKm,
          durationSecs: a.durationSecs,
          avgPaceSecKm: a.avgPaceSecKm,
          avgHeartRate: a.avgHeartRate,
          activityType: a.activityType,
        }))}
      />

      {/* Total km footer */}
      {totalRunKm > 0 && (
        <p className="text-center text-sm pb-2" style={{ color: "var(--text-muted)" }}>
          {totalRunKm.toFixed(1)} km logged in total since starting the plan
        </p>
      )}
    </div>
  );
}
