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
const MAX_CONDITIONS = 2.0;
const EXPECTED_ELEVATION_PER_KM = 10;

/** VDOT bracket table — distance targets (km) per run type. */
const VDOT_DISTANCE_TABLE: Array<{ vdot: number; easy: number; long: number; tempo: number; interval: number }> = [
  { vdot: 30, easy: 5,  long: 10, tempo: 5,  interval: 4  },
  { vdot: 35, easy: 6,  long: 13, tempo: 6,  interval: 5  },
  { vdot: 40, easy: 7,  long: 16, tempo: 7,  interval: 6  },
  { vdot: 45, easy: 8,  long: 18, tempo: 9,  interval: 7  },
  { vdot: 50, easy: 9,  long: 20, tempo: 10, interval: 8  },
  { vdot: 55, easy: 10, long: 23, tempo: 12, interval: 9  },
  { vdot: 60, easy: 12, long: 26, tempo: 14, interval: 10 },
  { vdot: 65, easy: 13, long: 29, tempo: 15, interval: 11 },
  { vdot: 70, easy: 14, long: 32, tempo: 16, interval: 12 },
];

/** VDOT bracket table — duration targets (minutes) per run type. */
const VDOT_DURATION_TABLE: Array<{ vdot: number; easy: number; long: number; tempo: number; interval: number }> = [
  { vdot: 30, easy: 35, long: 70,  tempo: 28, interval: 28 },
  { vdot: 35, easy: 40, long: 80,  tempo: 32, interval: 32 },
  { vdot: 40, easy: 45, long: 88,  tempo: 36, interval: 35 },
  { vdot: 45, easy: 48, long: 92,  tempo: 40, interval: 38 },
  { vdot: 50, easy: 52, long: 97,  tempo: 45, interval: 40 },
  { vdot: 55, easy: 56, long: 105, tempo: 50, interval: 43 },
  { vdot: 60, easy: 62, long: 115, tempo: 56, interval: 46 },
  { vdot: 65, easy: 67, long: 120, tempo: 60, interval: 48 },
  { vdot: 70, easy: 72, long: 128, tempo: 64, interval: 50 },
];

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
  confirmedRunType?: string | null;
  isConfirmed?: boolean;
  splitsJson?: any | null;
  durationSecs?: number | null;
}

export interface RunRatingComponentBreakdown {
  score: number;
  max: number;
  reason: string;
}

export interface ConditionsBreakdown extends RunRatingComponentBreakdown {
  weather?: number;
  elevation?: number;
  timeOfDayAdjusted?: boolean;
}

export interface DistanceSignal {
  source: "prior" | "vdot" | "plan";
  benchmarkKm: number;
  benchmarkMin: number;
  weight: number;
}

export interface DistanceBreakdown extends RunRatingComponentBreakdown {
  benchmarkKm: number;
  benchmarkMin: number;
  signals: DistanceSignal[];
  distanceRatio: number;
  durationRatio: number;
  combinedRatio: number;
  neutralApplied?: boolean;
  overshootCapped?: boolean;
}

export interface PaceBreakdown extends RunRatingComponentBreakdown {
  deviation: number;
  softenedDeviation: number;
  direction: "fast" | "slow" | "none";
  outsideZone: boolean;
  trendSignal: "improving" | "stable" | "insufficient";
  softeningApplied: boolean;
  hrAboveZone: number;
  hrModifier: number;
  trustHrApplied: boolean;
  blendedTarget: number;
  zoneLo: number;
  zoneHi: number;
  bufferedLo: number;
  bufferedHi: number;
}

export interface RunRatingResult {
  total: number;
  band?: "Elite" | "Strong" | "Solid" | "Rough" | "Off Day";
  floorApplied?: boolean;
  floorReason?: string;
  fatigueBonusApplied?: boolean;
  personalBests?: string[];
  components: {
    pace: PaceBreakdown;
    effort: RunRatingComponentBreakdown;
    distance: DistanceBreakdown;
    conditions: ConditionsBreakdown;
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
    && (rating.fatigueBonusApplied === undefined || typeof rating.fatigueBonusApplied === "boolean")
    && (rating.personalBests === undefined || Array.isArray(rating.personalBests))
    && !!components
    && isRatingComponent(components.pace)
    && isRatingComponent(components.effort)
    && isRatingComponent(components.distance)
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
  k: number = 0.7,
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

/** Returns the arithmetic mean of a numeric array, or 0 for an empty array. */
function mean(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((s, n) => s + n, 0) / nums.length;
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

/** Maps a total score to a rating band name. */
export function ratingBand(total: number): "Elite" | "Strong" | "Solid" | "Rough" | "Off Day" {
  if (total >= 8.5) return "Elite";
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
  const stored = activity.confirmedRunType || activity.classifiedRunType;
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

/** Returns true when the run's Brisbane local time falls in the 10am–2pm heat window. */
function isMiddayBrisbane(date: Date | string): boolean {
  const brisbaneHour = (new Date(date).getUTCHours() + 10) % 24;
  return brisbaneHour >= 10 && brisbaneHour < 14;
}

/** Piecewise weather factor (0–1) based on Dew Point calculation. */
function weatherFactorPiecewise(
  tempC: number | null | undefined,
  humidityPct: number | null | undefined,
): { factor: number; desc: string } {
  if (tempC == null || Number.isNaN(tempC) || humidityPct == null || Number.isNaN(humidityPct)) {
    return { factor: 0.5, desc: "Incomplete weather data — neutral weather factor." };
  }

  // DewPoint ≈ Temp - ((100 - Humidity)/5)
  const dp = tempC - ((100 - humidityPct) / 5);
  
  let factor: number;
  if (dp > 24) factor = 1.0;
  else if (dp > 21) factor = 0.9;
  else if (dp > 18) factor = 0.8;
  else if (dp > 15) factor = 0.65;
  else factor = 0.5;

  return { factor, desc: `${tempC.toFixed(1)}°C, ${humidityPct.toFixed(0)}% (DP: ${dp.toFixed(1)}°C) → weather factor ${factor.toFixed(2)}.` };
}

/** Piecewise elevation factor (0–1) based on elevation gain per km. */
function elevationFactorPiecewise(elevationPerKm: number | null): { factor: number; desc: string } {
  if (elevationPerKm == null) {
    return { factor: 0.5, desc: "No elevation data — neutral elevation factor." };
  }
  let factor: number;
  if (elevationPerKm >= 50) factor = 1.0;
  else if (elevationPerKm >= 30) factor = 0.9;
  else if (elevationPerKm >= 15) factor = 0.8;
  else if (elevationPerKm >= 5) factor = 0.65;
  else factor = 0.5;
  return { factor, desc: `${elevationPerKm.toFixed(1)} m/km → elevation factor ${factor.toFixed(2)}.` };
}

/** Parses split HR values from splits JSON and returns the median, or null when insufficient data. */
function medianSplitHr(splitsJson: any | null | undefined): number | null {
  if (!splitsJson) return null;
  try {
    const splits = typeof splitsJson === "string" ? JSON.parse(splitsJson) : splitsJson;
    const hrs = (splits as Array<{ average_heartrate?: number }>)
      .map((s) => s.average_heartrate)
      .filter((v): v is number => typeof v === "number" && v > 0);
    if (hrs.length < 3) return null;
    return median(hrs);
  } catch {
    return null;
  }
}

/** Returns blended pace target: VDOT midpoint alone when <3 priors, else 70/30 blend with prior median. */
function getBlendedPaceTarget(
  vdotMidpoint: number,
  priorRunMedian: number | null,
  priorRunCount: number,
): number {
  if (priorRunCount < 3 || priorRunMedian === null) return vdotMidpoint;
  return vdotMidpoint * 0.7 + priorRunMedian * 0.3;
}

/** Checks last 5 same-type paces (most-recent-first) for a meaningful speed-up trend (≥3% faster). */
function getPaceTrend(priorPaces: number[]): "improving" | "stable" | "insufficient" {
  if (priorPaces.length < 3) return "insufficient";
  const recent = priorPaces.slice(0, 2);
  const older  = priorPaces.slice(2, 5);
  if (older.length === 0) return "insufficient";
  return mean(recent) < mean(older) * 0.97 ? "improving" : "stable";
}

/** Pace HR modifier: exempt for tempo/interval; piecewise reduction for easy/long based on HR above zone upper bound. */
function hrModifierForPace(hrAboveZone: number, runType: RunType): number {
  if (runType === "tempo" || runType === "interval") return 1.0;
  if (hrAboveZone < 0.03) return 1.0;
  if (hrAboveZone < 0.10) return 0.80;
  if (hrAboveZone < 0.25) return 0.60;
  return 0.35;
}

/** Returns the VDOT distance target (km) for a run type using the nearest bracket at or below the VDOT value. */
export function getVdotDistanceTarget(vdot: number, runType: RunType): number {
  const clamped = Math.max(30, Math.min(70, vdot));
  let row = VDOT_DISTANCE_TABLE[0]!;
  for (const r of VDOT_DISTANCE_TABLE) {
    if (r.vdot <= clamped) row = r;
  }
  return row[runType];
}

/** Returns the VDOT duration target (minutes) for a run type using the nearest bracket at or below the VDOT value. */
export function getVdotDurationTarget(vdot: number, runType: RunType): number {
  const clamped = Math.max(30, Math.min(70, vdot));
  let row = VDOT_DURATION_TABLE[0]!;
  for (const r of VDOT_DURATION_TABLE) {
    if (r.vdot <= clamped) row = r;
  }
  return row[runType];
}

/** Calculates a 0-10 run quality score and returns component scores plus explanation text. */
export function calculateRunRating(
  activity: StatActivity,
  settings: UserSettings,
  recentSameType: StatActivity[],
  options?: {
    planContext?: { targetDistanceKm?: number; targetDurationMin?: number };
    recentActivities?: StatActivity[];
  },
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
  const zoneStr = `${formatPace(zoneLo)}–${formatPace(zoneHi)}/km`;

  const elevM = activity.elevationGainM;
  const hasElevationData =
    elevM != null
    && !Number.isNaN(elevM)
    && activity.distanceKm > 0;
  const elevationPerKm = hasElevationData ? elevM! / activity.distanceKm : null;

  // ── 1. Pace (max 3.0) ─────────────────────────────────────────────────────────
  const bufferedLo = zoneLo - 10;
  const bufferedHi = zoneHi + 10;

  // Blended pace target: zone midpoint + 30% weight on prior median when ≥3 same-type priors
  const priorPaces = recentSameType
    .filter((r) => r.id !== activity.id && r.avgPaceSecKm > 0)
    .slice(0, 5)
    .map((r) => r.avgPaceSecKm);
  const priorPaceMedian = priorPaces.length > 0 ? median(priorPaces) : null;
  const blendedTarget = getBlendedPaceTarget(zoneMid, priorPaceMedian, priorPaces.length);

  // Pace trend for fast-undershoot softening (easy/long only)
  const trendSignal = getPaceTrend(priorPaces);

  // HR signals for pace modifier and trust-HR branch (use avgHeartRate per spec)
  const hrForPace = activity.avgHeartRate ?? null;
  const zoneUpperBpm = hrFracZone(runType)[1] * s.maxHR;
  const hrAboveZone = hrForPace != null && hrForPace > 0
    ? Math.max(0, (hrForPace - zoneUpperBpm) / zoneUpperBpm)
    : 0;
  const paceHrModifier = hrModifierForPace(hrAboveZone, runType);

  // Trust HR branch: easy/long, faster than zone lo, HR ≤ 75% maxHR → deviation = 0
  const trustHrApplied =
    (runType === "easy" || runType === "long")
    && activity.avgPaceSecKm < zoneLo
    && hrForPace != null
    && hrForPace > 0
    && hrForPace / s.maxHR <= 0.75;

  // Zone-edge deviation (10 s buffer either side before penalty starts)
  let paceDeviation: number;
  let outsideZone: boolean;
  let paceDirection: "fast" | "slow" | "none";
  if (trustHrApplied) {
    paceDeviation = 0; outsideZone = false; paceDirection = "none";
  } else if (activity.avgPaceSecKm >= bufferedLo && activity.avgPaceSecKm <= bufferedHi) {
    paceDeviation = 0; outsideZone = false; paceDirection = "none";
  } else if (activity.avgPaceSecKm < bufferedLo) {
    paceDeviation = (bufferedLo - activity.avgPaceSecKm) / (zoneHi - zoneLo);
    outsideZone = true; paceDirection = "fast";
  } else {
    paceDeviation = (activity.avgPaceSecKm - bufferedHi) / (zoneHi - zoneLo);
    outsideZone = true; paceDirection = "slow";
  }

  // Trend softening: improving easy/long runs that are faster than zone get 25% deviation reduction
  const softeningApplied =
    paceDirection === "fast"
    && trendSignal === "improving"
    && (runType === "easy" || runType === "long");
  const softenedDeviation = softeningApplied ? paceDeviation * 0.75 : paceDeviation;

  const paceScoreBase = MAX_PACE * Math.exp(-0.7 * softenedDeviation);
  const finalPaceScore = paceScoreBase * paceHrModifier;

  let paceReason: string;
  if (trustHrApplied) {
    paceReason =
      `${classificationPreamble}Pace ${paceKmStr(activity.avgPaceSecKm)} faster than zone lower bound (${paceKmStr(zoneLo)}), but HR ${Math.round(hrForPace!)} bpm ≤ ${Math.round(0.75 * s.maxHR)} bpm — trust HR, scored as inside zone.`;
  } else if (!outsideZone) {
    paceReason =
      `${classificationPreamble}Pace ${paceKmStr(activity.avgPaceSecKm)} inside ${runTypeLabel(runType)} zone (${zoneStr}, ±10 s buffer). Blended target ${paceKmStr(Math.round(blendedTarget))}.`;
  } else {
    const dirStr = paceDirection === "fast" ? "faster than" : "slower than";
    const softenNote = softeningApplied ? ` Trend softening applied (deviation × 0.75).` : "";
    const modNote = paceHrModifier < 1.0
      ? ` HR modifier ${paceHrModifier.toFixed(2)} (HR ${Math.round(hrForPace!)} bpm, ${(hrAboveZone * 100).toFixed(0)}% above zone upper ${Math.round(zoneUpperBpm)} bpm).`
      : "";
    paceReason =
      `${classificationPreamble}Pace ${paceKmStr(activity.avgPaceSecKm)} ${dirStr} ${runTypeLabel(runType)} zone (${zoneStr}). ` +
      `Deviation ${paceDeviation.toFixed(2)}${softeningApplied ? ` → ${softenedDeviation.toFixed(2)}` : ""}.${softenNote}${modNote}`;
  }

  // ── 2. Effort (max 3.5) ───────────────────────────────────────────────────────
  // Use median split HR when ≥3 splits available, else fall back to avgHeartRate (Change 5)
  const splitHr = medianSplitHr(activity.splitsJson);
  const hr = splitHr ?? activity.avgHeartRate ?? null;
  const hrSource = splitHr != null ? "median split HR" : "average HR";

  let effortScoreRaw: number;
  let effortReason: string;
  const neutralEffort = MAX_EFFORT / 2;
  if (hr == null || hr <= 0) {
    effortScoreRaw = neutralEffort;
    effortReason =
      `${classificationPreamble}No heart rate recorded — neutral score applied.`;
  } else {
    const maxHR = Math.max(1, s.maxHR);
    const [fLo, fHi] = hrFracZone(runType);
    const bpmLo = fLo * maxHR;
    const bpmHi = fHi * maxHR;
    const mid = (bpmLo + bpmHi) / 2;
    const half = Math.max(1e-6, (bpmHi - bpmLo) / 2);
    const dev = Math.abs(hr - mid) / half;
    effortScoreRaw = scoreFromDeviation(dev, MAX_EFFORT);
    const vs =
      hr > mid + half * 0.1
        ? "above"
        : hr < mid - half * 0.1
          ? "below"
          : "close to";
    effortReason =
      `${classificationPreamble}${hrSource} ${Math.round(hr)} bpm was ${vs} the ${runTypeLabel(runType)} zone midpoint (${Math.round(bpmLo)}–${Math.round(bpmHi)} bpm from max HR ${maxHR}).`;
  }

  // Fatigue context bonus: Acute Training Load (ATL) proxy
  let fatigueBonusApplied = false;
  const recentActivities = options?.recentActivities ?? [];
  if (recentActivities.length > 0) {
    const nowMs = new Date(activity.date).getTime();
    const dayMs = 86400000;
    
    let atlLoad = 0;
    let ctlLoad = 0;

    for (const r of recentActivities) {
      const rDateMs = new Date(r.date).getTime();
      const daysOld = (nowMs - rDateMs) / dayMs;
      if (daysOld < 0 || daysOld > 28) continue;

      const intensity = r.avgHeartRate && r.avgHeartRate > 0
        ? r.avgHeartRate / Math.max(1, s.maxHR)
        : 0.75;
      const load = (r.durationSecs ?? 0) * intensity;

      if (daysOld <= 7) atlLoad += load;
      ctlLoad += load;
    }

    const atl = atlLoad / 7;
    const ctl = ctlLoad / 28;

    if (ctl > 0 && atl > ctl * 1.25 && (runType === "easy" || runType === "long")) {
      effortScoreRaw = Math.min(MAX_EFFORT, effortScoreRaw + 0.4);
      fatigueBonusApplied = true;
      effortReason += " [Fatigue bonus applied: Recent 7-day training load is significantly higher than your 28-day baseline.]";
    }
  }

  // ── 3. Distance (max 1.5) — three-signal VDOT-based benchmark ────────────────
  const vdot = s.currentVdot ?? 33;
  const vdotDistKm  = getVdotDistanceTarget(vdot, runType);
  const vdotDurMin  = getVdotDurationTarget(vdot, runType);

  const sameTypeActivities = recentSameType
    .filter((r) => r.id !== activity.id)
    .filter((r) => resolveRatingRunType(r, s.intervalPaceMaxSec, s.tempoPaceMaxSec, s) === runType)
    .filter((r) => r.distanceKm > 0);

  const hasPriorSignal = sameTypeActivities.length >= 5;
  const hasPlanSignal  = (options?.planContext?.targetDistanceKm ?? 0) > 0;

  // Signal A: median of all-time same-type priors
  const priorDistKm = hasPriorSignal ? median(sameTypeActivities.map((r) => r.distanceKm)) : 0;
  const priorDurList = hasPriorSignal
    ? sameTypeActivities.map((r) => r.durationSecs).filter((d): d is number => d != null && d > 0)
    : [];
  const priorDurMin = priorDurList.length > 0 ? median(priorDurList) / 60 : vdotDurMin;

  // Signal C: plan session
  const planDistKm = hasPlanSignal ? options!.planContext!.targetDistanceKm! : 0;
  const planDurMin = hasPlanSignal
    ? (options?.planContext?.targetDurationMin ?? planDistKm * (vdotDurMin / Math.max(vdotDistKm, 0.001)))
    : 0;

  // Weighted benchmark from available signals
  const distSignals: DistanceSignal[] = [];
  if (hasPriorSignal && hasPlanSignal) {
    distSignals.push({ source: "prior", benchmarkKm: priorDistKm, benchmarkMin: priorDurMin, weight: 0.5 });
    distSignals.push({ source: "vdot",  benchmarkKm: vdotDistKm,  benchmarkMin: vdotDurMin,  weight: 0.3 });
    distSignals.push({ source: "plan",  benchmarkKm: planDistKm,  benchmarkMin: planDurMin,  weight: 0.2 });
  } else if (hasPriorSignal) {
    distSignals.push({ source: "prior", benchmarkKm: priorDistKm, benchmarkMin: priorDurMin, weight: 0.6 });
    distSignals.push({ source: "vdot",  benchmarkKm: vdotDistKm,  benchmarkMin: vdotDurMin,  weight: 0.4 });
  } else if (hasPlanSignal) {
    distSignals.push({ source: "vdot", benchmarkKm: vdotDistKm, benchmarkMin: vdotDurMin, weight: 0.7 });
    distSignals.push({ source: "plan", benchmarkKm: planDistKm,  benchmarkMin: planDurMin,  weight: 0.3 });
  } else {
    distSignals.push({ source: "vdot", benchmarkKm: vdotDistKm, benchmarkMin: vdotDurMin, weight: 1.0 });
  }

  const weightedBenchmarkKm  = distSignals.reduce((s, x) => s + x.benchmarkKm  * x.weight, 0);
  const weightedBenchmarkMin = distSignals.reduce((s, x) => s + x.benchmarkMin * x.weight, 0);

  const distRatio = weightedBenchmarkKm > 0 ? activity.distanceKm / weightedBenchmarkKm : 1;
  const actDurMin = (activity.durationSecs != null && activity.durationSecs > 0)
    ? activity.durationSecs / 60
    : null;
  const durRatio  = actDurMin != null && weightedBenchmarkMin > 0
    ? actDurMin / weightedBenchmarkMin
    : distRatio;
  const combinedRatio = distRatio * 0.6 + durRatio * 0.4;

  let distanceScoreRaw: number;
  const neutralApplied  = distRatio < 0.6;
  const overshootCapped = !neutralApplied && combinedRatio > 1.2;
  if (neutralApplied) {
    distanceScoreRaw = 0.75;
  } else {
    distanceScoreRaw = Math.min(MAX_DISTANCE, distanceScoreFromRatio(combinedRatio));
  }

  const signalDescs = distSignals
    .map((sig) => {
      const label = sig.source === "prior"
        ? `prior median (${sameTypeActivities.length} runs)`
        : sig.source === "plan" ? "plan session"
        : `VDOT ${vdot}`;
      return `${label}: ${sig.benchmarkKm.toFixed(1)} km / ${sig.benchmarkMin.toFixed(0)} min (w=${sig.weight})`;
    })
    .join(", ");
  const neutralNote = neutralApplied ? " Severe undershoot (ratio < 0.6) → neutral 0.75." : "";
  const distanceReason =
    `${classificationPreamble}Benchmark ${weightedBenchmarkKm.toFixed(1)} km / ${weightedBenchmarkMin.toFixed(0)} min [${signalDescs}]. ` +
    `Your ${activity.distanceKm.toFixed(2)} km, ratio ${distRatio.toFixed(2)}.${neutralNote}`;

  // ── 4. Conditions (max 2.0) — piecewise weather + time-of-day + elevation (Change 1) ──
  const { factor: weatherFactor, desc: weatherDesc } = weatherFactorPiecewise(
    activity.temperatureC,
    activity.humidityPct,
  );
  const inMidday = isMiddayBrisbane(activity.date);
  const adjustedWeatherFactor = inMidday ? Math.min(1.0, weatherFactor + 0.05) : weatherFactor;
  const { factor: elevationFactor, desc: elevDesc } = elevationFactorPiecewise(elevationPerKm);
  const conditionsRaw = adjustedWeatherFactor * 0.6 + elevationFactor * 0.4;
  const conditionsScoreRaw = conditionsRaw * MAX_CONDITIONS;
  const todNote = inMidday ? " (+0.05 midday heat adjustment)" : "";
  const conditionsReason =
    `${classificationPreamble}${weatherDesc}${todNote} ${elevDesc} Combined: ${conditionsScoreRaw.toFixed(2)} / ${MAX_CONDITIONS}.`;

  // ── Final assembly ─────────────────────────────────────────────────────────────
  // Round only the final total, not individual components (Change 11)
  const rawTotal = finalPaceScore + effortScoreRaw + distanceScoreRaw + conditionsScoreRaw;
  // Floor 2.0 (Change 9)
  const total = round1(Math.max(2.0, Math.min(10, rawTotal)));
  const band = ratingBand(total);
  const floorApplied = rawTotal < 2.0;
  const floorReason = floorApplied
    ? "Minimum score of 2.0 applied — completing a run always counts."
    : undefined;

  return {
    total,
    band,
    ...(floorApplied ? { floorApplied: true, floorReason } : {}),
    ...(fatigueBonusApplied ? { fatigueBonusApplied: true } : {}),
    components: {
      pace: {
        score: finalPaceScore,
        max: MAX_PACE,
        reason: paceReason,
        deviation: paceDeviation,
        softenedDeviation,
        direction: paceDirection,
        outsideZone,
        trendSignal,
        softeningApplied,
        hrAboveZone,
        hrModifier: paceHrModifier,
        trustHrApplied,
        blendedTarget,
        zoneLo,
        zoneHi,
        bufferedLo,
        bufferedHi,
      },
      effort:   { score: effortScoreRaw,   max: MAX_EFFORT,     reason: effortReason },
      distance: {
        score: distanceScoreRaw,
        max: MAX_DISTANCE,
        reason: distanceReason,
        benchmarkKm: weightedBenchmarkKm,
        benchmarkMin: weightedBenchmarkMin,
        signals: distSignals,
        distanceRatio: distRatio,
        durationRatio: durRatio,
        combinedRatio,
        ...(neutralApplied  ? { neutralApplied: true }  : {}),
        ...(overshootCapped ? { overshootCapped: true } : {}),
      },
      conditions: {
        score: conditionsScoreRaw,
        max: MAX_CONDITIONS,
        reason: conditionsReason,
        weather: adjustedWeatherFactor,
        elevation: elevationFactor,
        timeOfDayAdjusted: inMidday,
      },
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
