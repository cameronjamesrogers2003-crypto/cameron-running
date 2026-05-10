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

/** Per-type benchmark distances and durations used when fewer than 5 prior runs exist. */
const DISTANCE_TARGETS: Record<RunType, { distanceKm: number; durationSecs: number }> = {
  easy:     { distanceKm: 7,  durationSecs: 3000 },
  long:     { distanceKm: 18, durationSecs: 5400 },
  tempo:    { distanceKm: 10, durationSecs: 2400 },
  interval: { distanceKm: 8,  durationSecs: 2700 },
};

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

export interface RunRatingResult {
  total: number;
  band?: "Elite" | "Strong" | "Solid" | "Rough" | "Off Day";
  floorApplied?: boolean;
  floorReason?: string;
  fatigueBonusApplied?: boolean;
  personalBests?: string[];
  components: {
    pace: RunRatingComponentBreakdown;
    effort: RunRatingComponentBreakdown;
    distance: RunRatingComponentBreakdown;
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

/** Returns true when the run's Brisbane local time falls in the 10am–2pm heat window. */
function isMiddayBrisbane(date: Date | string): boolean {
  const brisbaneHour = (new Date(date).getUTCHours() + 10) % 24;
  return brisbaneHour >= 10 && brisbaneHour < 14;
}

/** Piecewise weather factor (0–1) based on temperature and humidity. */
function weatherFactorPiecewise(
  tempC: number | null | undefined,
  humidityPct: number | null | undefined,
): { factor: number; desc: string } {
  if (tempC == null || Number.isNaN(tempC)) {
    return { factor: 0.5, desc: "No temperature data — neutral weather factor." };
  }
  const h = humidityPct;
  const hasHumidity = h != null && !Number.isNaN(h);
  const humDisp = hasHumidity ? `${(h as number).toFixed(0)}%` : "—";
  const hot = tempC >= 32;
  const humid = hasHumidity && (h as number) > 80;
  let factor: number;
  if (hot && humid) factor = 1.0;
  else if (hot || humid) factor = 0.95;
  else if (tempC >= 28) factor = 0.85;
  else if (tempC >= 24) factor = 0.75;
  else if (tempC >= 18) factor = 0.6;
  else factor = 0.5;
  return { factor, desc: `${tempC.toFixed(1)}°C, ${humDisp} → weather factor ${factor.toFixed(2)}.` };
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
function medianSplitHr(splitsJson: string | null | undefined): number | null {
  if (!splitsJson) return null;
  try {
    const splits = JSON.parse(splitsJson) as Array<{ average_heartrate?: number }>;
    const hrs = splits
      .map((s) => s.average_heartrate)
      .filter((v): v is number => typeof v === "number" && v > 0);
    if (hrs.length < 3) return null;
    return median(hrs);
  } catch {
    return null;
  }
}

/** Calculates a 0-10 run quality score and returns component scores plus explanation text. */
export function calculateRunRating(
  activity: StatActivity,
  settings: UserSettings,
  recentActivities: StatActivity[],
  priorActivity?: StatActivity | null,
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
  // Widen tolerance for interval/tempo by 1.3× (Change 3)
  const effectiveHalfWidth = (runType === "interval" || runType === "tempo")
    ? halfWidth * 1.3
    : halfWidth;
  const zoneStr = `${formatPace(zoneLo)}–${formatPace(zoneHi)}/km`;

  const elevM = activity.elevationGainM;
  const hasElevationData =
    elevM != null
    && !Number.isNaN(elevM)
    && activity.distanceKm > 0;
  const elevationPerKm = hasElevationData ? elevM! / activity.distanceKm : null;
  const elevAdjFactor = elevationPerKm != null ? elevationPerKm / EXPECTED_ELEVATION_PER_KM : null;
  const elevAdjClamped = elevAdjFactor != null ? clamp(elevAdjFactor, 0.5, 2.5) : 1;
  const adjustedMidpoint = zoneMid * (1 + 0.04 * (elevAdjClamped - 1));

  // ── 1. Pace (max 3.0) ─────────────────────────────────────────────────────────
  let paceForDeviation = activity.avgPaceSecKm;
  let usedEasyHrMidpoint = false;
  // Trust HR branch for easy AND long runs when faster than zone lower bound (Change 4)
  if (
    (runType === "easy" || runType === "long")
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

  const paceDeviation = Math.abs(paceForDeviation - adjustedMidpoint) / effectiveHalfWidth;
  const paceScoreRaw = scoreFromDeviation(paceDeviation, MAX_PACE);

  let paceReason: string;
  const hillNote =
    elevAdjClamped !== 1
      ? ` Base zone midpoint ${paceKmStr(zoneMid)} → hill-adjusted ${paceKmStr(adjustedMidpoint)}.`
      : "";
  if (usedEasyHrMidpoint) {
    paceReason =
      `Pace ${paceKmStr(activity.avgPaceSecKm)} was faster than your ${runTypeLabel(runType)} zone lower bound (${paceKmStr(zoneLo)}), but HR ${activity.avgHeartRate} bpm is ≤ ${Math.round(0.75 * s.maxHR)} bpm (75% of max HR ${s.maxHR}) — scored vs midpoint ${paceKmStr(adjustedMidpoint)}.${hillNote}`;
  } else {
    const rel =
      activity.avgPaceSecKm < adjustedMidpoint - effectiveHalfWidth * 0.15
        ? "near the fast edge"
        : activity.avgPaceSecKm > adjustedMidpoint + effectiveHalfWidth * 0.15
          ? "near the slow edge"
          : "close to the centre";
    paceReason =
      `Pace ${paceKmStr(activity.avgPaceSecKm)} was ${rel} of your ${runTypeLabel(runType)} zone (${zoneStr}), vs midpoint ${paceKmStr(adjustedMidpoint)}.${hillNote}`;
  }
  paceReason = classificationPreamble + paceReason;

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

  // Fatigue context bonus: +0.3 effort when running easy/long the day after a hard session (Change 7)
  let fatigueBonusApplied = false;
  if (priorActivity != null && (runType === "easy" || runType === "long")) {
    const priorType = priorActivity.classifiedRunType;
    if (priorType === "interval" || priorType === "tempo") {
      const BRISBANE_OFFSET_MS = 10 * 60 * 60 * 1000;
      const d1 = Math.floor((new Date(priorActivity.date).getTime() + BRISBANE_OFFSET_MS) / 86400000);
      const d2 = Math.floor((new Date(activity.date).getTime() + BRISBANE_OFFSET_MS) / 86400000);
      if (d2 - d1 === 1) {
        effortScoreRaw = Math.min(MAX_EFFORT, effortScoreRaw + 0.3);
        fatigueBonusApplied = true;
        effortReason += " [+0.3 fatigue bonus: running after a hard session]";
      }
    }
  }

  // ── 3. Distance (max 1.5) ──────────────────────────────────────────────────────
  // Score vs type targets when <5 priors; vs median when ≥5 (Change 6)
  const sameTypeActivities = recentActivities
    .filter((r) => r.id !== activity.id)
    .filter((r) => {
      const rType = resolveRatingRunType(r, s.intervalPaceMaxSec, s.tempoPaceMaxSec, s);
      return rType === runType;
    })
    .filter((r) => r.distanceKm > 0);

  let distanceScoreRaw: number;
  let distanceReason: string;
  if (sameTypeActivities.length < 5) {
    const target = DISTANCE_TARGETS[runType];
    const distRatio = activity.distanceKm / target.distanceKm;
    const hasDur = activity.durationSecs != null && activity.durationSecs > 0;
    const durRatio = hasDur ? activity.durationSecs! / target.durationSecs : distRatio;
    const combinedRatio = distRatio * 0.6 + durRatio * 0.4;
    distanceScoreRaw = Math.min(MAX_DISTANCE, distanceScoreFromRatio(combinedRatio));
    distanceReason =
      `${classificationPreamble}Fewer than 5 prior ${runTypeLabel(runType)} runs — scored vs target ${target.distanceKm} km / ${Math.round(target.durationSecs / 60)} min (ratio ${combinedRatio.toFixed(2)}).`;
  } else {
    const dists = sameTypeActivities.map((r) => r.distanceKm);
    const durList = sameTypeActivities
      .map((r) => r.durationSecs)
      .filter((d): d is number => d != null && d > 0);
    const bench = median(dists);
    const benchDur = durList.length > 0 ? median(durList) : 0;
    const distRatio = bench > 0 ? activity.distanceKm / bench : 0;
    const hasDur = activity.durationSecs != null && activity.durationSecs > 0;
    const durRatio = hasDur && benchDur > 0 ? activity.durationSecs! / benchDur : distRatio;
    const combinedRatio = distRatio * 0.6 + durRatio * 0.4;
    distanceScoreRaw = Math.min(MAX_DISTANCE, distanceScoreFromRatio(combinedRatio));
    distanceReason =
      `${classificationPreamble}Your ${activity.distanceKm.toFixed(2)} km vs median ${bench.toFixed(2)} km from ${sameTypeActivities.length} prior ${runTypeLabel(runType)} runs (ratio ${combinedRatio.toFixed(2)}).`;
  }

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
  const rawTotal = paceScoreRaw + effortScoreRaw + distanceScoreRaw + conditionsScoreRaw;
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
      pace:     { score: paceScoreRaw,     max: MAX_PACE,       reason: paceReason },
      effort:   { score: effortScoreRaw,   max: MAX_EFFORT,     reason: effortReason },
      distance: { score: distanceScoreRaw, max: MAX_DISTANCE,   reason: distanceReason },
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
