import prisma from "@/lib/db";
import PlayerCard from "@/components/PlayerCard";
import { TIERS, getTier } from "@/lib/playerCardTiers";
import { RunTypePill } from "@/components/RunTypePill";
import { EmptyState } from "@/components/EmptyState";
import { buildTrainingPlan, type TrainingWeek } from "@/data/trainingPlan";
import { inferRunType, type StatActivity } from "@/lib/rating";
import { dbSettingsToUserSettings, DEFAULT_SETTINGS, formatPace, getDisplayName, type UserSettings } from "@/lib/settings";
import {
  type PlayerRatingAttribute,
  ratingConditionsScore,
} from "@/lib/playerRating";
import { formatAEST, startOfNextDayAEST } from "@/lib/dateUtils";
import { getEffectivePlanStart, parsePlanFirstSessionDay } from "@/lib/planUtils";
import { Star } from "lucide-react";
import PageHeading from "@/components/ui/PageHeading";

export const dynamic = "force-dynamic";
export const metadata = { title: "Runshift — Rating" };

type AttributeExplanationKey = Exclude<PlayerRatingAttribute, "overall">;

type CalendarRatingActivity = StatActivity & {
  activityType: string;
  ratingBreakdown?: any | null;
};

function formatKm(value: number): string {
  return `${Math.round(value * 10) / 10} km`;
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

  if (key === "resilience") {
    const runsWithSplits = recent30.filter((a) => (a.splitsJson ?? "").length > 0);
    if (runsWithSplits.length === 0) {
      return "No per-km split data found in the last 30 days. Run with a Strava-connected watch to track pace consistency and recovery quality.";
    }
    return `Based on ${runsWithSplits.length} ${runsWithSplits.length === 1 ? "run" : "runs"} with split data in the last 30 days. Consistent even splits and running after hard efforts lift this score.`;
  }

  if (key === "hrEfficiency") {
    const easyLongHrRuns = recent30.filter((a) => {
      const rt = inferRunType(a, settings);
      return a.avgPaceSecKm > 0 && (a.avgHeartRate ?? 0) > 0 && (rt === "easy" || rt === "long");
    });
    if (easyLongHrRuns.length === 0) {
      return "No HR data on easy or long runs found in the last 30 days. Run more aerobic runs with your HR monitor to improve this score.";
    }
    const avgPace = Math.round(easyLongHrRuns.reduce((sum, a) => sum + a.avgPaceSecKm, 0) / easyLongHrRuns.length);
    const avgHr = Math.round(easyLongHrRuns.reduce((sum, a) => sum + (a.avgHeartRate ?? 0), 0) / easyLongHrRuns.length);
    return `Based on ${easyLongHrRuns.length} easy/long HR ${easyLongHrRuns.length === 1 ? "run" : "runs"} averaging ${formatPace(avgPace)}/km at ${avgHr} bpm. Run more aerobic runs with your HR monitor to improve this score.`;
  }

  const conditionRuns = recent30;
  if (conditionRuns.length === 0) {
    return "No runs found in the last 30 days, so toughness has no recent conditions data. Keep logging runs with weather data to improve this.";
  }
  const avgConditions =
    conditionRuns.reduce((sum, a) => sum + ratingConditionsScore(a.ratingBreakdown), 0) / conditionRuns.length;
  return `Your average conditions score is ${avgConditions.toFixed(2)} across ${conditionRuns.length} recent ${conditionRuns.length === 1 ? "run" : "runs"}. Brisbane summer will push this up naturally.`;
}

const ATTRIBUTE_META = [
  { key: "speed", fullName: "Speed", color: "var(--c-interval)" },
  { key: "endurance", fullName: "Endurance", color: "var(--c-long)" },
  { key: "resilience", fullName: "Resilience", color: "var(--c-tempo)" },
  { key: "hrEfficiency", fullName: "HR Efficiency", color: "var(--c-easy)" },
  { key: "toughness", fullName: "Toughness", color: "#f5b454" },
] as const;

const TIER_MESSAGES: Record<string, string> = {
  Newcomer: "Every run builds your foundation.",
  "Building Base": "Consistency is compounding.",
  "Developing Runner": "Your aerobic engine is growing.",
  Competitive: "You're running faster than most.",
  "Elite Amateur": "World class is within reach.",
  "World Class": "You've earned this.",
};

export default async function RatingPage() {
  const today = new Date();
  const playerRating = await prisma.playerRating.findFirst({ orderBy: { updatedAt: "desc" } });
  const settings = await prisma.userSettings
    .findUnique({ where: { id: 1 } })
    .then((r) => (r ? dbSettingsToUserSettings(r) : DEFAULT_SETTINGS));

  const recentRuns = await prisma.activity.findMany({
    where: { rating: { not: null } },
    orderBy: { date: "desc" },
    take: 5,
  });

  const statsStart = new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000);
  const statsActivities = await prisma.activity.findMany({
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
      splitsJson: true,
      name: true,
      durationSecs: true,
    },
  });

  const planStart = getEffectivePlanStart(settings.planStartDate, parsePlanFirstSessionDay(settings.trainingDays));
  const plan = buildTrainingPlan(settings);

  if (!playerRating) {
    return (
      <div className="rating-shell w-full max-w-5xl">
        <div className="flex items-start justify-between pt-2 mb-6 gap-3">
          <div>
            <PageHeading subtitle="Your athletic profile">Player Rating</PageHeading>
          </div>
        </div>
        <div className="rounded-2xl border bg-[var(--card-bg)] border-white/[0.08]">
          <EmptyState
            icon={<Star className="w-7 h-7" style={{ color: "var(--accent)" }} />}
            title="No rating yet"
            body="Sync your first run from Strava to generate your player rating."
          />
        </div>
      </div>
    );
  }

  const ovr = Math.round(playerRating.overall ?? 1);
  const tier = getTier(ovr);
  const currentTierIndex = Math.max(0, TIERS.findIndex((t) => t.name === tier.name));
  const nextTier = TIERS[currentTierIndex + 1] ?? null;
  const pointsToNext = nextTier ? Math.max(0, nextTier.min - ovr) : 0;

  return (
    <div className="rating-shell w-full max-w-5xl">
      <div className="flex items-start justify-between pt-2 mb-6 gap-3">
        <div>
          <PageHeading subtitle="Your athletic profile">Player Rating</PageHeading>
        </div>
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          Last updated: {playerRating?.updatedAt ? formatAEST(playerRating.updatedAt, "d MMM yyyy, h:mm a") : "—"}
        </p>
      </div>

      <p className="text-xs font-semibold tracking-widest uppercase mb-3" style={{ color: "var(--text-label)" }}>
        Running Card
      </p>
      <div className="w-full max-w-[780px] mx-auto mb-6 flex justify-center px-3 sm:px-0">
        <PlayerCard
          ovr={ovr}
          name={getDisplayName(settings).toUpperCase()}
          spd={Math.round(playerRating?.speed ?? 1)}
          end={Math.round(playerRating?.endurance ?? 1)}
          res={Math.round(playerRating?.resilience ?? 1)}
          eff={Math.round(playerRating?.hrEfficiency ?? 1)}
          tgh={Math.round(playerRating?.toughness ?? 1)}
          prevOvr={playerRating?.prevOverall ?? undefined}
          mode="full"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mt-5">
        {ATTRIBUTE_META.map((attr, idx) => {
          const score = Math.round(playerRating?.[attr.key] ?? 1);
          const explanation = playerAttributeExplanation(
            attr.key,
            statsActivities,
            plan,
            settings,
            planStart,
            today,
          );
          return (
            <div
              key={attr.key}
              className={`rounded-2xl border bg-[var(--card-bg)] border-white/[0.08] p-4 ${idx === 4 ? "md:col-span-2 lg:col-span-1 lg:col-start-2" : ""}`}
            >
              <div className="flex items-center justify-between mb-3 gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="shrink-0" style={{ width: 8, height: 8, borderRadius: "50%", background: attr.color }} />
                  <span className="text-base font-semibold text-white truncate" title={attr.fullName}>
                    {attr.fullName}
                  </span>
                </div>
                <span className="text-xl font-black font-mono tabular-nums shrink-0" style={{ color: attr.color }}>
                  {score}
                </span>
              </div>
              <div className="h-2 rounded-full bg-white/[0.08] overflow-hidden mb-3">
                <div className="h-full rounded-full transition-all duration-700" style={{ width: `${score}%`, background: attr.color }} />
              </div>
              <p className="text-xs leading-relaxed" style={{ color: "var(--text-dim)" }}>
                {explanation}
              </p>
            </div>
          );
        })}
      </div>

      <p className="text-xs font-semibold tracking-widest uppercase mt-6 mb-3" style={{ color: "var(--text-label)" }}>
        Tier Progression
      </p>
      <div className="flex rounded-xl overflow-hidden h-3 mb-3">
        {TIERS.map((t, idx) => {
          const reached = idx <= currentTierIndex;
          return (
            <div
              key={t.name}
              style={{
                width: `${100 / TIERS.length}%`,
                background: reached ? t.accentColor : "rgba(255,255,255,0.08)",
                opacity: idx === currentTierIndex ? 1 : reached ? 0.75 : 1,
              }}
            />
          );
        })}
      </div>
      <div className="flex justify-between text-xs" style={{ color: "var(--text-dim)" }}>
        <span>Newcomer</span>
        <span>Building</span>
        <span>Developing</span>
        <span>Competitive</span>
        <span>Elite</span>
        <span>World Class</span>
      </div>

      <div className="rounded-2xl p-4 mt-3.5" style={{ background: tier.accentDim, border: `1px solid ${tier.borderColor}` }}>
        <p className="text-sm font-semibold" style={{ color: tier.accentColor }}>
          {tier.name}
        </p>
        <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
          OVR range: {tier.min} — {tier.max}
        </p>
        <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
          {nextTier ? `${pointsToNext} points to ${nextTier.name}` : "Top tier reached"}
        </p>
        <p className="text-xs mt-2" style={{ color: "white" }}>
          {TIER_MESSAGES[tier.name]}
        </p>
      </div>

      <p className="text-xs font-semibold tracking-widest uppercase mt-6 mb-2" style={{ color: "var(--text-label)" }}>
        Recent Runs
      </p>
      <div className="rounded-2xl border bg-[var(--card-bg)] border-white/[0.08] p-4">
        {recentRuns.length === 0 && (
          <p className="text-sm text-center py-3" style={{ color: "var(--text-muted)" }}>
            No rated runs yet.
          </p>
        )}
        {recentRuns.map((run) => {
          const runType = inferRunType(run as StatActivity, settings);
          const score = run.rating ?? 0;
          const ratingColor = score >= 8.5 ? "#4ade80" : score >= 7.0 ? "#f59e0b" : score >= 5.5 ? "#f97316" : "#ef4444";
          return (
            <div key={run.id} className="flex items-center gap-3 py-2.5 border-b border-white/[0.06] last:border-0">
              <RunTypePill type={runType} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="text-sm text-white truncate">{run.name ?? "Run"}</p>
                <p className="text-xs" style={{ color: "var(--text-dim)" }}>
                  {formatAEST(run.date, "EEE d MMM")}
                </p>
              </div>
              <p className="text-sm font-mono" style={{ color: "var(--text-muted)" }}>
                {run.distanceKm.toFixed(2)} km
              </p>
              <p className="font-mono font-black tabular-nums" style={{ color: ratingColor }}>
                {score.toFixed(1)}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
