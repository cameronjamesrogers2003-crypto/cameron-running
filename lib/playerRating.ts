import type { PlayerRating, PrismaClient } from "@prisma/client";
import { buildTrainingPlan, type RunType, type TrainingWeek } from "@/data/trainingPlan";
import { parseInterruptionType, type PlanInterruption } from "@/lib/interruptions";
import { inferRunType, parseRatingBreakdown, type StatActivity } from "@/lib/rating";
import { dbSettingsToUserSettings, DEFAULT_SETTINGS, type UserSettings } from "@/lib/settings";
import { loadGeneratedPlan } from "@/lib/planStorage";

const RUNNING_TYPES = ["running", "trail_running"];
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export type PlayerRatingAttribute =
  | "overall"
  | "speed"
  | "endurance"
  | "resilience"
  | "hrEfficiency"
  | "toughness";

export type PlayerRatingScores = Record<PlayerRatingAttribute, number>;

export type PlayerRatingDelta = Record<PlayerRatingAttribute, number>;

export interface PlayerRatingSummaryRow {
  key: PlayerRatingAttribute;
  label: string;
  before: number;
  after: number;
  delta: number;
  reason: string;
}

export interface PlayerRatingLike extends PlayerRatingScores {
  id: string;
  updatedAt: Date | string;
  prevOverall: number;
  prevSpeed: number;
  prevEndurance: number;
  prevResilience: number;
  prevHrEfficiency: number;
  prevToughness: number;
}

export const PLAYER_RATING_ATTRIBUTES: Array<{
  key: Exclude<PlayerRatingAttribute, "overall">;
  label: string;
  name: string;
}> = [
  { key: "speed", label: "SPD", name: "Speed" },
  { key: "endurance", label: "END", name: "Endurance" },
  { key: "resilience", label: "RES", name: "Resilience" },
  { key: "hrEfficiency", label: "EFF", name: "HR Efficiency" },
  { key: "toughness", label: "TGH", name: "Toughness" },
];

type RatingActivity = StatActivity & {
  activityType: string;
  ratingBreakdown?: any | null;
};

type SummaryActivity = StatActivity & {
  activityType?: string | null;
  ratingBreakdown?: any | null;
};

/** Clamps a number to a closed range and returns the bounded value. */
function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/** Converts a normalized 0-1 signal into a 1-99 player rating score. */
function scoreFromRaw(raw: number): number {
  return clamp(Math.round(clamp(raw, 0, 1) * 98) + 1, 1, 99);
}

/** Maps a value from a min/max range into a 1-99 player rating score. */
function scoreFromRange(value: number, minValue: number, maxValue: number): number {
  return scoreFromRaw((value - minValue) / (maxValue - minValue));
}

/** Rounds a numeric score and returns it inside the 1-99 player rating range. */
function roundRating(n: number): number {
  return clamp(Math.round(n), 1, 99);
}

/** Resolves the canonical run type for a stored activity and user settings. */
function getRunType(a: RatingActivity | StatActivity, settings: UserSettings): RunType {
  return inferRunType(a, settings);
}

/** Returns true when an activity is a running or trail-running activity. */
function isRunningActivity(a: { activityType?: string | null }): boolean {
  return RUNNING_TYPES.includes(a.activityType ?? "");
}

/** Calculates the speed attribute from recent tempo and interval pace. */
function calculateSpeed(activities: RatingActivity[], settings: UserSettings, now: Date): number {
  const since = new Date(now.getTime() - 42 * MS_PER_DAY);
  const qualifying = activities.filter((a) => {
    const d = new Date(a.date);
    if (d < since || d > now || a.avgPaceSecKm <= 0) return false;
    const type = getRunType(a, settings);
    return type === "tempo" || type === "interval";
  });

  if (qualifying.length === 0) return 1;

  const weightedBestPace = qualifying.reduce((best, run) => {
    const runDate = new Date(run.date);
    const daysOld = Math.floor((now.getTime() - runDate.getTime()) / MS_PER_DAY);
    const weight = daysOld <= 14 ? 1.0 : 0.8;
    const effectivePace = run.avgPaceSecKm / weight;
    return effectivePace < best ? effectivePace : best;
  }, Number.POSITIVE_INFINITY);
  if (!Number.isFinite(weightedBestPace)) return 1;

  const speedKmMin = (1 / weightedBestPace) * 60;
  const worldRecord = (1 / 173) * 60;
  const slowest = (1 / 600) * 60;
  return scoreFromRaw((speedKmMin - slowest) / (worldRecord - slowest));
}

/** Calculates the endurance attribute from recent longest run and weekly volume. */
function calculateEndurance(activities: RatingActivity[], now: Date): number {
  const since30 = new Date(now.getTime() - 30 * MS_PER_DAY);
  const since28 = new Date(now.getTime() - 28 * MS_PER_DAY);
  const last30 = activities.filter((a) => {
    const d = new Date(a.date);
    return d >= since30 && d <= now;
  });
  const last28 = activities.filter((a) => {
    const d = new Date(a.date);
    return d >= since28 && d <= now;
  });

  const longestRun = last30.reduce((max, a) => Math.max(max, a.distanceKm), 0);
  const avgWeeklyKm = last28.reduce((sum, a) => sum + a.distanceKm, 0) / 4;
  const longScore = clamp((longestRun - 1) / (42.2 - 1), 0, 1);
  const volScore = clamp((avgWeeklyKm - 1) / (160 - 1), 0, 1);
  return scoreFromRaw((longScore + volScore) / 2);
}

/** Calculates the resilience attribute from intra-run pace consistency and back-to-back recovery. */
function calculateResilience(
  activities: RatingActivity[],
  settings: UserSettings,
  now: Date,
): number {
  const since = new Date(now.getTime() - 30 * MS_PER_DAY);
  const recent = activities.filter((a) => {
    const d = new Date(a.date);
    return d >= since && d <= now;
  });

  if (recent.length === 0) return 1;

  // Part A: pace consistency within each run (lower variance = higher score)
  let splitScoreSum = 0;
  let splitCount = 0;
  for (const act of recent) {
    if (!act.splitsJson) continue;
    try {
      const splits = typeof act.splitsJson === "string" ? JSON.parse(act.splitsJson) : act.splitsJson;
      const paces = (splits as Array<{ average_speed?: number; distance?: number }>)
        .filter(
          (s) =>
            typeof s.average_speed === "number" &&
            s.average_speed > 0 &&
            (s.distance ?? 0) >= 800,
        )
        .map((s) => 1000 / (s.average_speed as number));
      if (paces.length < 3) continue;
      const avg = paces.reduce((sum, p) => sum + p, 0) / paces.length;
      if (avg <= 0) continue;
      const mad = paces.reduce((sum, p) => sum + Math.abs(p - avg), 0) / (avg * paces.length);
      splitScoreSum += Math.exp(-5 * mad);
      splitCount++;
    } catch {
      // ignore parse errors
    }
  }
  const partA = splitCount > 0 ? splitScoreSum / splitCount : 0.5;

  // Part B: ability to run after hard efforts (back-to-back recovery quality)
  const sorted = [...recent].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );
  let backToBackScore = 0;
  let backToBackCount = 0;
  const maxHR = Math.max(1, settings.maxHR);

  for (let i = 0; i < sorted.length - 1; i++) {
    const hard = sorted[i]!;
    const next = sorted[i + 1]!;
    const hardType = getRunType(hard, settings);
    if (hardType !== "tempo" && hardType !== "interval") continue;
    const gapHours =
      (new Date(next.date).getTime() - new Date(hard.date).getTime()) / 3_600_000;
    if (gapHours > 36) continue;
    backToBackCount++;
    const hrFrac = next.avgHeartRate ? next.avgHeartRate / maxHR : null;
    // Credit if the recovery run HR stayed in an easy/aerobic zone
    const inZone = hrFrac != null ? hrFrac >= 0.55 && hrFrac <= 0.82 : true;
    backToBackScore += inZone ? 1.0 : 0.5;
  }
  const partB = backToBackCount > 0 ? backToBackScore / backToBackCount : 0.5;

  const combined =
    splitCount > 0 && backToBackCount > 0
      ? partA * 0.6 + partB * 0.4
      : splitCount > 0
      ? partA
      : backToBackCount > 0
      ? partB
      : 0.5;

  return scoreFromRaw(combined);
}

/** Calculates the HR efficiency attribute from recent easy-run pace per heart-rate effort. */
function calculateHrEfficiency(
  activities: RatingActivity[],
  settings: UserSettings,
  now: Date,
): number {
  const since = new Date(now.getTime() - 30 * MS_PER_DAY);
  const maxHR = Math.max(1, settings.maxHR);
  const ratios = activities
    .filter((a) => {
      const d = new Date(a.date);
      return (
        d >= since
        && d <= now
        && a.avgPaceSecKm > 0
        && (a.avgHeartRate ?? 0) > 0
        && (getRunType(a, settings) === "easy" || getRunType(a, settings) === "long")
      );
    })
    .map((a) => {
      const speedKmMin = (1 / a.avgPaceSecKm) * 60;
      return speedKmMin / ((a.avgHeartRate ?? 0) / maxHR);
    });

  if (ratios.length === 0) return 1;

  const avgRatio = ratios.reduce((sum, ratio) => sum + ratio, 0) / ratios.length;
  const eliteRatio = 0.4545;
  const beginnerRatio = 0.08;
  return scoreFromRaw((avgRatio - beginnerRatio) / (eliteRatio - beginnerRatio));
}

/** Returns the stored run-rating conditions score, defaulting to neutral when absent. */
export function ratingConditionsScore(ratingBreakdown: string | null | undefined): number {
  return parseRatingBreakdown(ratingBreakdown)?.components.conditions.score ?? 1.0;
}

/** Calculates the toughness attribute from recent run-rating conditions scores. */
function calculateToughness(activities: RatingActivity[], now: Date): number {
  const since = new Date(now.getTime() - 30 * MS_PER_DAY);
  const last30 = activities.filter((a) => {
    const d = new Date(a.date);
    return d >= since && d <= now;
  });

  if (last30.length === 0) return 1;

  const avgConditionsScore =
    last30.reduce((sum, a) => sum + ratingConditionsScore(a.ratingBreakdown), 0) / last30.length;
  return scoreFromRange(avgConditionsScore, 0.8, 2.0);
}

/** Calculates the weighted overall player rating from individual attributes. */
function calculateOverall(scores: Omit<PlayerRatingScores, "overall">): number {
  return roundRating(
    scores.speed * 0.28
    + scores.endurance * 0.32
    + scores.resilience * 0.15
    + scores.hrEfficiency * 0.15
    + scores.toughness * 0.10,
  );
}

/** Calculates all player rating attributes for a set of activities and settings. */
function calculateScores(
  activities: RatingActivity[],
  settings: UserSettings,
  _plan: TrainingWeek[],
  _interruptions: PlanInterruption[],
  now = new Date(),
): PlayerRatingScores {
  const runningActivities = activities.filter(isRunningActivity);
  const scores = {
    speed: calculateSpeed(runningActivities, settings, now),
    endurance: calculateEndurance(runningActivities, now),
    resilience: calculateResilience(runningActivities, settings, now),
    hrEfficiency: calculateHrEfficiency(runningActivities, settings, now),
    toughness: calculateToughness(runningActivities, now),
  };

  return {
    overall: calculateOverall(scores),
    ...scores,
  };
}

/** Builds the Prisma data payload for current and previous player rating scores. */
function ratingData(scores: PlayerRatingScores, previous: PlayerRatingScores = scores) {
  return {
    overall: scores.overall,
    speed: scores.speed,
    endurance: scores.endurance,
    resilience: scores.resilience,
    hrEfficiency: scores.hrEfficiency,
    toughness: scores.toughness,
    prevOverall: previous.overall,
    prevSpeed: previous.speed,
    prevEndurance: previous.endurance,
    prevResilience: previous.resilience,
    prevHrEfficiency: previous.hrEfficiency,
    prevToughness: previous.toughness,
  };
}

/** Extracts the current scores from a rating row for use as previous scores. */
function previousScores(row: PlayerRatingLike): PlayerRatingScores {
  return {
    overall: row.overall,
    speed: row.speed,
    endurance: row.endurance,
    resilience: row.resilience,
    hrEfficiency: row.hrEfficiency,
    toughness: row.toughness,
  };
}

/** Calculates per-attribute score deltas between two player rating snapshots. */
function deltaFrom(before: PlayerRatingScores, after: PlayerRatingScores): PlayerRatingDelta {
  return {
    overall: after.overall - before.overall,
    speed: after.speed - before.speed,
    endurance: after.endurance - before.endurance,
    resilience: after.resilience - before.resilience,
    hrEfficiency: after.hrEfficiency - before.hrEfficiency,
    toughness: after.toughness - before.toughness,
  };
}

/** Loads user settings from the database and returns defaults when no row exists. */
async function loadSettings(prisma: PrismaClient): Promise<UserSettings> {
  const settingsRow = await prisma.userSettings.findUnique({ where: { id: 1 } });
  return settingsRow ? dbSettingsToUserSettings(settingsRow) : DEFAULT_SETTINGS;
}

/** Loads plan interruptions from the database and returns typed interruption objects. */
async function loadInterruptions(prisma: PrismaClient): Promise<PlanInterruption[]> {
  const rows = await prisma.planInterruption.findMany({ orderBy: { startDate: "asc" } });
  return rows.map((row) => ({
    id: row.id,
    reason: row.reason,
    type: parseInterruptionType(row.type),
    startDate: new Date(row.startDate),
    endDate: row.endDate ? new Date(row.endDate) : null,
    weeklyKmEstimate: row.weeklyKmEstimate ?? null,
    notes: row.notes ?? null,
    weeksAffected: row.weeksAffected ?? null,
  }));
}

/** Loads running activities needed to calculate player rating scores. */
async function loadActivities(prisma: PrismaClient): Promise<RatingActivity[]> {
  return prisma.activity.findMany({
    where: { activityType: { in: RUNNING_TYPES } },
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
    },
  });
}

/** Calculates player rating scores from database state and returns all attributes. */
export async function calculatePlayerRatingScores(
  prisma: PrismaClient,
  settingsOverride?: UserSettings,
): Promise<PlayerRatingScores> {
  const [settings, interruptions, activities, storedPlan] = await Promise.all([
    settingsOverride ? Promise.resolve(settingsOverride) : loadSettings(prisma),
    loadInterruptions(prisma),
    loadActivities(prisma),
    loadGeneratedPlan(),
  ]);
  const plan = storedPlan?.plan ?? buildTrainingPlan(settings);

  return calculateScores(activities, settings, plan, interruptions);
}

/** Creates or replaces the single player rating row and returns the saved row. */
export async function initializePlayerRating(prisma: PrismaClient): Promise<PlayerRating> {
  const scores = await calculatePlayerRatingScores(prisma);
  const existing = await prisma.playerRating.findFirst({ orderBy: { updatedAt: "desc" } });
  const data = ratingData(scores);

  const row = existing
    ? await prisma.playerRating.update({ where: { id: existing.id }, data })
    : await prisma.playerRating.create({ data });

  await prisma.playerRating.deleteMany({ where: { id: { not: row.id } } });
  return row;
}

/** Recalculates the player rating against existing history and returns the saved row. */
export async function recalculatePlayerRating(prisma: PrismaClient): Promise<PlayerRating> {
  const scores = await calculatePlayerRatingScores(prisma);
  const existing = await prisma.playerRating.findFirst({ orderBy: { updatedAt: "desc" } });

  if (!existing) {
    return initializePlayerRating(prisma);
  }

  const before = previousScores(existing);
  const row = await prisma.playerRating.update({
    where: { id: existing.id },
    data: ratingData(scores, before),
  });

  await prisma.playerRating.deleteMany({ where: { id: { not: row.id } } });
  return row;
}

/** Updates the player rating after a relevant activity change and returns the rating delta. */
export async function updatePlayerRating(
  prisma: PrismaClient,
  newActivity: { id: string; activityType?: string | null } | null,
  settingsOverride?: UserSettings,
): Promise<{ rating: PlayerRatingLike; delta: PlayerRatingDelta } | null> {
  if (newActivity && !isRunningActivity(newActivity)) return null;

  const existing = await prisma.playerRating.findFirst({ orderBy: { updatedAt: "desc" } });
  if (!existing) {
    const rating = await initializePlayerRating(prisma);
    return { rating, delta: deltaFrom(previousScores(rating), previousScores(rating)) };
  }

  const [settings, interruptions, activities, storedPlan] = await Promise.all([
    settingsOverride ? Promise.resolve(settingsOverride) : loadSettings(prisma),
    loadInterruptions(prisma),
    loadActivities(prisma),
    loadGeneratedPlan(),
  ]);
  const before = previousScores(existing);
  const plan = storedPlan?.plan ?? buildTrainingPlan(settings);
  const scores = calculateScores(activities, settings, plan, interruptions);
  const rating = await prisma.playerRating.update({
    where: { id: existing.id },
    data: ratingData(scores, before),
  });

  await prisma.playerRating.deleteMany({ where: { id: { not: rating.id } } });
  return { rating, delta: deltaFrom(before, scores) };
}

/** Reads a previous score value for a player rating attribute. */
function prevValue(rating: PlayerRatingLike, key: PlayerRatingAttribute): number {
  switch (key) {
    case "overall":
      return rating.prevOverall;
    case "speed":
      return rating.prevSpeed;
    case "endurance":
      return rating.prevEndurance;
    case "resilience":
      return rating.prevResilience;
    case "hrEfficiency":
      return rating.prevHrEfficiency;
    case "toughness":
      return rating.prevToughness;
  }
}

/** Reads the current score value for a player rating attribute. */
function currentValue(rating: PlayerRatingLike, key: PlayerRatingAttribute): number {
  return rating[key];
}

/** Converts a score delta into a short trend word. */
function trendWord(delta: number): string {
  return delta > 0 ? "improved" : "dipped";
}

/** Builds a short explanation for a player rating attribute delta. */
function summaryReason(
  key: PlayerRatingAttribute,
  delta: number,
  run: SummaryActivity | null,
  settings: UserSettings,
): string {
  if (key === "overall") {
    if (delta === 0) return "Attributes held steady";
    return `Weighted attributes ${trendWord(delta)}`;
  }

  if (!run) {
    return delta === 0 ? "No synced run context" : "Rolling window changed";
  }

  const runType = getRunType(run, settings);
  if (key === "speed") {
    if (runType === "tempo" || runType === "interval") {
      return delta > 0
        ? `Strong ${runType} pace`
        : `${runType[0].toUpperCase()}${runType.slice(1)} pace left the 30-day benchmark lower`;
    }
    return delta === 0 ? "Speed work only" : "Older speed work rolled off";
  }

  if (key === "endurance") {
    if (runType === "long") return delta >= 0 ? "Long run boosted endurance" : "Older volume rolled off";
    return delta >= 0 ? "Weekly volume increased" : "Rolling volume decreased";
  }

  if (key === "resilience") {
    const hasSplits = (run.splitsJson ?? "").length > 0;
    if (delta === 0) return hasSplits ? "Splits consistency steady" : "No splits data yet";
    return delta > 0 ? "Improved pacing or back-to-back recovery" : "Pace variance or recovery dipped";
  }

  if (key === "hrEfficiency") {
    const hasHr = (run.avgHeartRate ?? 0) > 0;
    if ((runType === "easy" || runType === "long") && hasHr) {
      return delta >= 0 ? "Easy/long HR efficiency improved" : "Easy/long HR efficiency dipped";
    }
    if (delta !== 0) return "Older easy/long HR data rolled off";
    return hasHr ? "Easy/long runs only" : "No HR data";
  }

  const conditions = ratingConditionsScore(run.ratingBreakdown);
  if (delta === 0) return conditions > 1.1 ? "Conditions already reflected" : "Mild conditions";
  return conditions > 1.1 ? "Tough conditions added credit" : "Milder conditions lowered toughness";
}

/** Builds player rating summary rows for display and returns one row per attribute. */
export function buildPlayerRatingSummaryRows(
  rating: PlayerRatingLike,
  latestRun: SummaryActivity | null,
  settings: UserSettings,
): PlayerRatingSummaryRow[] {
  const attrs: Array<{ key: PlayerRatingAttribute; label: string }> = [
    { key: "overall", label: "OVR" },
    { key: "speed", label: "SPD" },
    { key: "endurance", label: "END" },
    { key: "resilience", label: "RES" },
    { key: "hrEfficiency", label: "EFF" },
    { key: "toughness", label: "TGH" },
  ];

  return attrs.map(({ key, label }) => {
    const before = Math.round(prevValue(rating, key));
    const after = Math.round(currentValue(rating, key));
    const delta = after - before;
    return {
      key,
      label,
      before,
      after,
      delta,
      reason: summaryReason(key, delta, latestRun, settings),
    };
  });
}
