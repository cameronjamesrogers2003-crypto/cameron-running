import type { RunType, Session, TrainingWeek } from "@/data/trainingPlan";
import {
  getEffectivePlanStart,
  getPlanWeekForDate,
  getSessionDate,
  isActivityOnOrAfterPlanStart,
  parsePlanFirstSessionDay,
} from "@/lib/planUtils";
import { sameDayAEST } from "@/lib/dateUtils";
import { getVdotFallbackLongRunThresholdKm } from "@/lib/longRunThreshold";
import { DEFAULT_SETTINGS, formatPace, type UserSettings } from "@/lib/settings";

export type { RunType };

const MAX_PACE = 3.0;
const MAX_EFFORT = 3.5;
const MAX_DISTANCE = 1.5;
const MAX_ELEVATION = 1.5;
const MAX_CONDITIONS = 0.5;

const EXPECTED_ELEVATION_PER_KM = 10;

/** Minimal activity fields used for classification and rating. */
export interface StatActivity {
  id: string;
  date: Date | string;
  distanceKm: number;
  avgPaceSecKm: number;
  avgHeartRate?: number | null;
  maxHeartRate?: number | null;
  temperatureC?: number | null;
  humidityPct?: number | null;
  elevationGainM?: number | null;
  rating?: number | null;
  classifiedRunType?: string | null;
  splitsJson?: string | null;
}

export interface RunRatingComponentBreakdown {
  score: number;
  max: number;
  reason: string;
}

export interface RunRatingResult {
  total: number;
  band?: "Elite" | "Strong" | "Solid" | "Rough" | "Off Day";
  /** When true, total was raised to the minimum completion floor. */
  floorApplied?: boolean;
  /** Explanation when floorApplied is true. */
  floorReason?: string;
  components: {
    pace: RunRatingComponentBreakdown;
    effort: RunRatingComponentBreakdown;
    distance: RunRatingComponentBreakdown;
    elevation: RunRatingComponentBreakdown;
    conditions: RunRatingComponentBreakdown;
  };
}

/** Checks parsed JSON component objects and returns true for a complete rating component. */
function isRatingComponent(value: unknown): value is RunRatingComponentBreakdown {
  if (!value || typeof value !== "object") return false;
  const component = value as Record<string, unknown>;
  return (
    typeof component.score === "number"
    && typeof component.max === "number"
    && typeof component.reason === "string"
  );
}

/** Checks parsed JSON objects and returns true for a complete run rating result. */
function isRunRatingResult(value: unknown): value is RunRatingResult {
  if (!value || typeof value !== "object") return false;
  const rating = value as Record<string, unknown>;
  const components = rating.components as Record<string, unknown> | undefined;
  return (
    typeof rating.total === "number"
    && (rating.band === undefined
      || rating.band === "Elite"
      || rating.band === "Strong"
      || rating.band === "Solid"
      || rating.band === "Rough"
      || rating.band === "Off Day")
    && (rating.floorApplied === undefined || typeof rating.floorApplied === "boolean")
    && (rating.floorReason === undefined || typeof rating.floorReason === "string")
    && !!components
    && isRatingComponent(components.pace)
    && isRatingComponent(components.effort)
    && isRatingComponent(components.distance)
    && isRatingComponent(components.elevation)
    && isRatingComponent(components.conditions)
  );
}

/** Rounds a score to one decimal place and returns the rounded number. */
function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/**
 * Exponential decay from deviation: full score at deviation 0, smooth falloff (no hard cutoffs).
 */
export function scoreFromDeviation(
  deviation: number,
  maxScore: number,
  k: number = 0.8,
): number {
  return maxScore * Math.exp(-k * deviation);
}

/** Looks up configured pace-zone bounds for a run type and returns lower/upper seconds per km. */
function paceZoneBounds(runType: RunType, s: UserSettings): { lo: number; hi: number } {
  switch (runType) {
    case "easy":
      return { lo: s.easyPaceMinSec, hi: s.easyPaceMaxSec };
    case "tempo":
      return { lo: s.tempoPaceMinSec, hi: s.tempoPaceMaxSec };
    case "interval":
      return { lo: s.intervalPaceMinSec, hi: s.intervalPaceMaxSec };
    case "long":
      return { lo: s.longPaceMinSec, hi: s.longPaceMaxSec };
  }
}

/** Looks up heart-rate effort bounds for a run type and returns max-HR fractions. */
function hrFracZone(runType: RunType): [number, number] {
  switch (runType) {
    case "easy":
    case "long":
      return [0.6, 0.75];
    case "tempo":
      return [0.8, 0.9];
    case "interval":
      return [0.9, 1.0];
  }
}

/** Returns the median of a numeric array, or 0 for an empty array. */
function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  if (s.length % 2 === 1) return s[m] ?? 0;
  const lo = s[m - 1];
  const hi = s[m];
  return lo !== undefined && hi !== undefined ? (lo + hi) / 2 : 0;
}

/** Converts actual-vs-benchmark distance ratio into the distance component score (max 1.5). */
function distanceScoreFromRatio(ratio: number): number {
  if (ratio >= 1.2) return 1.5;
  if (ratio >= 1.0) return 1.125 + 0.375 * ((ratio - 1.0) / 0.2);
  if (ratio >= 0.5) return 0.5625 + 0.5625 * ((ratio - 0.5) / 0.5);
  if (ratio > 0) return 0.5625 * (ratio / 0.5);
  return 0;
}

/** Formats seconds per km for rating explanation text and returns an em dash for invalid pace. */
function paceKmStr(secPerKm: number): string {
  if (!secPerKm || secPerKm <= 0) return "—";
  return `${formatPace(secPerKm)}/km`;
}

/** Converts a run type key into a human-readable label. */
function runTypeLabel(t: RunType): string {
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function ratingBand(total: number): "Elite" | "Strong" | "Solid" | "Rough" | "Off Day" {
  if (total >= 9.0) return "Elite";
  if (total >= 7.0) return "Strong";
  if (total >= 5.5) return "Solid";
  if (total >= 4.0) return "Rough";
  return "Off Day";
}

/** Uses stored enhanced classification when valid; otherwise pace-based zones. */
function resolveRatingRunType(
  activity: StatActivity,
  intervalPaceMaxSec: number,
  tempoPaceMaxSec: number,
  settings: UserSettings,
): RunType {
  const stored = activity.classifiedRunType;
  if (
    stored === "easy"
    || stored === "tempo"
    || stored === "interval"
    || stored === "long"
  ) {
    return stored as RunType;
  }
  return classifyRunByPaceZones(
    activity.avgPaceSecKm,
    activity.distanceKm,
    intervalPaceMaxSec,
    tempoPaceMaxSec,
    getVdotFallbackLongRunThresholdKm(settings),
  );
}

/** Calculates a 0-10 run quality score and returns component scores plus explanation text. */
export function calculateRunRating(
  activity: StatActivity,
  settings: UserSettings,
  recentActivities: StatActivity[],
): RunRatingResult {
  const s = settings;
  const runType = resolveRatingRunType(
    activity,
    s.intervalPaceMaxSec,
    s.tempoPaceMaxSec,
    s,
  );
  const usedStoredClassification =
    activity.classifiedRunType === "easy"
    || activity.classifiedRunType === "tempo"
    || activity.classifiedRunType === "interval"
    || activity.classifiedRunType === "long";
  const classificationPreamble = usedStoredClassification
    ? `Classified as ${runType} (enhanced classification). `
    : `Classified as ${runType} (pace-based fallback). `;

  const { lo: zoneLo, hi: zoneHi } = paceZoneBounds(runType, s);
  const zoneMid = (zoneLo + zoneHi) / 2;
  const halfWidth = Math.max(1e-6, (zoneHi - zoneLo) / 2);
  const zoneStr = `${formatPace(zoneLo)}–${formatPace(zoneHi)}/km`;

  const elevM = activity.elevationGainM;
  const hasElevationData =
    elevM != null
    && !Number.isNaN(elevM)
    && activity.distanceKm > 0;
  const elevationPerKm = hasElevationData ? elevM / activity.distanceKm : null;
  const elevationFactor =
    elevationPerKm != null ? elevationPerKm / EXPECTED_ELEVATION_PER_KM : null;
  const elevationFactorClamped =
    elevationFactor != null ? clamp(elevationFactor, 0.5, 2.5) : 1;

  const adjustedMidpoint =
    zoneMid * (1 + 0.04 * (elevationFactorClamped - 1));

  let elevationScoreRaw: number;
  let elevationReason: string;
  if (!hasElevationData) {
    elevationScoreRaw = MAX_ELEVATION / 2;
    elevationReason =
      classificationPreamble
      + (activity.distanceKm <= 0
        ? "Invalid distance — elevation scoring neutral."
        : "No elevation data — neutral score applied.");
  } else {
    const elevationDeviation = Math.abs(elevationFactorClamped - 1);
    elevationScoreRaw = scoreFromDeviation(elevationDeviation, MAX_ELEVATION, 0.9);
    elevationReason =
      classificationPreamble
      + `Elevation ${elevM.toFixed(0)} m over ${activity.distanceKm.toFixed(2)} km `
      + `(${elevationPerKm!.toFixed(1)} m/km vs baseline ${EXPECTED_ELEVATION_PER_KM} m/km, `
      + `factor ${elevationFactorClamped.toFixed(2)}).`;
  }

  // ── 1. Pace (max 3.0) + reason ───────────────────────────────────────────
  let paceForDeviation = activity.avgPaceSecKm;
  let usedEasyHrMidpoint = false;
  if (
    runType === "easy"
    && activity.avgPaceSecKm < zoneLo
    && activity.avgHeartRate != null
    && activity.avgHeartRate > 0
  ) {
    const hrFrac = activity.avgHeartRate / s.maxHR;
    if (hrFrac <= 0.75) {
      paceForDeviation = adjustedMidpoint;
      usedEasyHrMidpoint = true;
    }
  }

  const paceDeviation = Math.abs(paceForDeviation - adjustedMidpoint) / halfWidth;
  const paceScoreRaw = scoreFromDeviation(paceDeviation, MAX_PACE, 0.8);

  let paceReason: string;
  const hillNote =
    elevationFactorClamped !== 1
      ? ` Base zone midpoint ${paceKmStr(zoneMid)} → hill-adjusted ${paceKmStr(adjustedMidpoint)}.`
      : "";
  if (usedEasyHrMidpoint) {
    paceReason =
      `Pace ${paceKmStr(activity.avgPaceSecKm)} was faster than your Easy zone lower bound (${paceKmStr(zoneLo)}), but HR ${activity.avgHeartRate} bpm is ≤ ${Math.round(0.75 * s.maxHR)} bpm (75% of max HR ${s.maxHR}) — scored vs midpoint ${paceKmStr(adjustedMidpoint)}.${hillNote}`;
  } else {
    const rel =
      activity.avgPaceSecKm < adjustedMidpoint - halfWidth * 0.15
        ? "near the fast edge"
        : activity.avgPaceSecKm > adjustedMidpoint + halfWidth * 0.15
          ? "near the slow edge"
          : "close to the centre";
    paceReason =
      `Pace ${paceKmStr(activity.avgPaceSecKm)} was ${rel} of your ${runTypeLabel(runType)} zone (${zoneStr}), vs midpoint ${paceKmStr(adjustedMidpoint)}.${hillNote}`;
  }
  paceReason = classificationPreamble + paceReason;

  // ── 2. Effort (max 3.5) + reason ───────────────────────────────────────────
  const hr = activity.avgHeartRate;
  let effortScoreRaw: number;
  let effortReason: string;
  const neutralEffort = MAX_EFFORT / 2;
  if (hr == null || hr <= 0) {
    effortScoreRaw = neutralEffort;
    effortReason =
      `${classificationPreamble}No average heart rate recorded — neutral score applied.`;
  } else {
    const maxHR = Math.max(1, s.maxHR);
    const [fLo, fHi] = hrFracZone(runType);
    const bpmLo = fLo * maxHR;
    const bpmHi = fHi * maxHR;
    const mid = (bpmLo + bpmHi) / 2;
    const half = Math.max(1e-6, (bpmHi - bpmLo) / 2);
    const dev = Math.abs(hr - mid) / half;
    effortScoreRaw = scoreFromDeviation(dev, MAX_EFFORT, 0.8);
    const vs =
      hr > mid + half * 0.1
        ? "above"
        : hr < mid - half * 0.1
          ? "below"
          : "close to";
    effortReason =
      `${classificationPreamble}HR ${hr} bpm was ${vs} the ${runTypeLabel(runType)} zone midpoint (${Math.round(bpmLo)}–${Math.round(bpmHi)} bpm from max HR ${maxHR}).`;
  }

  // ── 3. Distance (max 1.5) + reason ────────────────────────────────────────
  const dists = recentActivities
    .filter((r) => r.id !== activity.id)
    .filter((r) => {
      const rType = resolveRatingRunType(
        r,
        s.intervalPaceMaxSec,
        s.tempoPaceMaxSec,
        s,
      );
      return rType === runType;
    })
    .map((r) => r.distanceKm)
    .filter((d) => d > 0);
  let distanceScoreRaw: number;
  let distanceReason: string;
  if (dists.length < 3) {
    distanceScoreRaw = 0.75;
    distanceReason =
      `${classificationPreamble}Not enough prior ${runTypeLabel(runType)} runs yet to calculate a benchmark — neutral score applied (${dists.length} of 3 needed).`;
  } else if (dists.length < 5) {
    distanceScoreRaw = 0.9;
    distanceReason =
      `${classificationPreamble}Early ${runTypeLabel(runType)} benchmark signal from ${dists.length} prior runs — partial credit applied until 5 runs are available.`;
  } else {
    const bench = median(dists);
    const ratio = bench > 0 ? activity.distanceKm / bench : 0;
    distanceScoreRaw = Math.min(MAX_DISTANCE, distanceScoreFromRatio(ratio));
    distanceReason =
      `${classificationPreamble}Your ${activity.distanceKm.toFixed(2)} km vs median ${bench.toFixed(2)} km from ${dists.length} prior ${runTypeLabel(runType)} runs (ratio ${ratio.toFixed(2)}).`;
  }

  // ── 4. Conditions (max 0.5) + reason — same heat/humidity logic, scaled ──
  const t = activity.temperatureC;
  let conditionsScoreRaw: number;
  let conditionsReason: string;
  if (t == null || Number.isNaN(t)) {
    conditionsScoreRaw = 0.25;
    conditionsReason = "No temperature data — neutral score applied.";
  } else {
    let bonus = 0;
    const bonusParts: string[] = [];
    if (t > 28) {
      const hBonus = Math.min(0.3, (t - 28) * 0.1);
      bonus += hBonus;
      bonusParts.push(`heat bonus +${hBonus.toFixed(1)}`);
    }
    const h = activity.humidityPct;
    if (h != null && !Number.isNaN(h) && h > 80) {
      const hu = Math.min(0.2, Math.floor((h - 80) / 5) * 0.1);
      bonus += hu;
      bonusParts.push(`humidity bonus +${hu.toFixed(1)}`);
    }
    const rawUnitScale = Math.min(1.0, 0.8 + bonus);
    conditionsScoreRaw = rawUnitScale * MAX_CONDITIONS;
    const humDisp = h != null && !Number.isNaN(h) ? `${h.toFixed(0)}%` : "—";
    if (bonus === 0) {
      conditionsReason = `Normal conditions (${t.toFixed(1)}°C, ${humDisp}) — base contribution ${(0.8 * MAX_CONDITIONS).toFixed(2)} / ${MAX_CONDITIONS}.`;
    } else {
      const label = t > 28 ? "Hot conditions" : "Humid conditions";
      conditionsReason = `${label} (${t.toFixed(1)}°C, ${humDisp}) — ${bonusParts.join(", ")} → ${conditionsScoreRaw.toFixed(2)} / ${MAX_CONDITIONS}.`;
    }
  }

  const pace = round1(paceScoreRaw);
  const effort = round1(effortScoreRaw);
  const distance = round1(distanceScoreRaw);
  const elevation = round1(elevationScoreRaw);
  const conditions = round1(conditionsScoreRaw);
  const rawTotal = pace + effort + distance + elevation + conditions;
  const total = round1(Math.max(3.0, Math.min(10, rawTotal)));
  const band = ratingBand(total);
  const floorApplied = rawTotal < 3.0;
  const floorReason = floorApplied
    ? "Minimum score of 3.0 applied — completing a run always counts."
    : undefined;

  return {
    total,
    band,
    ...(floorApplied ? { floorApplied: true, floorReason } : {}),
    components: {
      pace:       { score: pace,       max: MAX_PACE,       reason: paceReason },
      effort:     { score: effort,     max: MAX_EFFORT,     reason: effortReason },
      distance:   { score: distance,   max: MAX_DISTANCE,   reason: distanceReason },
      elevation:  { score: elevation,  max: MAX_ELEVATION,  reason: elevationReason },
      conditions: { score: conditions, max: MAX_CONDITIONS, reason: conditionsReason },
    },
  };
}

/** Parses stored rating JSON and returns a validated rating breakdown, or null when invalid. */
export function parseRatingBreakdown(json: string | null | undefined): RunRatingResult | null {
  if (!json || !json.trim()) return null;
  try {
    const parsed: unknown = JSON.parse(json);
    return isRunRatingResult(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/** Classifies a run by configured pace thresholds and returns the canonical run type. */
export function classifyRunByPaceZones(
  avgPaceSecKm: number,
  distanceKm: number,
  intervalPaceMaxSec: number,
  tempoPaceMaxSec: number,
  longRunThresholdKm: number = 15,
): RunType {
  if (avgPaceSecKm <= intervalPaceMaxSec) return "interval";
  if (avgPaceSecKm <= tempoPaceMaxSec) return "tempo";
  if (distanceKm >= longRunThresholdKm) return "long";
  return "easy";
}

/** Returns the stored run type when valid, otherwise classifies the run from pace zones. */
export function inferRunType(run: StatActivity, settings: UserSettings = DEFAULT_SETTINGS): RunType {
  if (run.classifiedRunType === "easy" || run.classifiedRunType === "tempo"
    || run.classifiedRunType === "interval" || run.classifiedRunType === "long") {
    return run.classifiedRunType;
  }
  return classifyRunByPaceZones(
    run.avgPaceSecKm,
    run.distanceKm,
    settings.intervalPaceMaxSec,
    settings.tempoPaceMaxSec,
    getVdotFallbackLongRunThresholdKm(settings),
  );
}

/** Finds the planned session matching a run's plan week/date and returns it, or null. */
export function resolveRunSession(
  run: StatActivity,
  plan: TrainingWeek[],
  planStart: Date,
): Session | null {
  const runDate = new Date(run.date);
  if (!isActivityOnOrAfterPlanStart(runDate, planStart)) return null;

  const weekNum = getPlanWeekForDate(runDate, planStart);

  if (weekNum <= 0 || weekNum > plan.length) return null;

  const planWeek = plan[weekNum - 1];
  for (const session of planWeek.sessions) {
    const sessionDate = getSessionDate(weekNum, session.day, planStart);
    if (sameDayAEST(runDate, sessionDate)) return session;
  }

  return null;
}

/** Resolves a run type from its planned session first, otherwise from canonical pace-zone classification. */
export function resolveRunType(run: StatActivity, plan: TrainingWeek[], settings: UserSettings = DEFAULT_SETTINGS): RunType {
  const planStart = getEffectivePlanStart(settings.planStartDate, parsePlanFirstSessionDay(settings.trainingDays));
  return resolveRunSession(run, plan, planStart)?.type ?? inferRunType(run, settings);
}

/** Resolves the planned target pace for a run and returns seconds per km, or null when unmatched. */
export function resolveTargetPaceSecKm(run: StatActivity, plan: TrainingWeek[], settings: UserSettings): number | null {
  const planStart = getEffectivePlanStart(settings.planStartDate, parsePlanFirstSessionDay(settings.trainingDays));
  const session = resolveRunSession(run, plan, planStart);
  return session ? Math.round(session.targetPaceMinPerKm * 60) : null;
}
