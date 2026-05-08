import type { RunType, Session, TrainingWeek } from "@/data/trainingPlan";
import {
  getEffectivePlanStart,
  getPlanWeekForDate,
  getSessionDate,
  isActivityOnOrAfterPlanStart,
} from "@/lib/planUtils";
import { sameDayAEST } from "@/lib/dateUtils";
import { DEFAULT_SETTINGS, formatPace, type UserSettings } from "@/lib/settings";

export type { RunType };

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
  components: {
    pace: RunRatingComponentBreakdown;
    effort: RunRatingComponentBreakdown;
    distance: RunRatingComponentBreakdown;
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

/** Converts a normalized deviation into a component score and returns zero past the outer band. */
function scoreFromDeviation(deviation: number, a0: number, a1: number, a2: number): number {
  if (deviation <= 0) return a0;
  if (deviation <= 1) return a0 + (a1 - a0) * deviation;
  if (deviation <= 2) return a1 + (a2 - a1) * (deviation - 1);
  return 0;
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

/** Converts actual-vs-benchmark distance ratio into the distance component score. */
function distanceScoreFromRatio(ratio: number): number {
  if (ratio >= 1.2) return 2.0;
  if (ratio >= 1.0) return 1.5 + (2.0 - 1.5) * ((ratio - 1.0) / 0.2);
  if (ratio >= 0.5) return 0.75 + (1.5 - 0.75) * ((ratio - 0.5) / 0.5);
  if (ratio > 0) return 0.75 * (ratio / 0.5);
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

/** Calculates a 0-10 run quality score and returns component scores plus explanation text. */
export function calculateRunRating(
  activity: StatActivity,
  settings: UserSettings,
  recentActivities: StatActivity[],
): RunRatingResult {
  const s = settings;
  const runType = classifyRunByPaceZones(
    activity.avgPaceSecKm,
    activity.distanceKm,
    s.intervalPaceMaxSec,
    s.tempoPaceMaxSec,
  );

  const { lo: zoneLo, hi: zoneHi } = paceZoneBounds(runType, s);
  const zoneMid = (zoneLo + zoneHi) / 2;
  const halfWidth = Math.max(1e-6, (zoneHi - zoneLo) / 2);
  const zoneStr = `${formatPace(zoneLo)}–${formatPace(zoneHi)}/km`;

  // ── 1. Pace (max 4.0) + reason ───────────────────────────────────────────
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
      paceForDeviation = zoneMid;
      usedEasyHrMidpoint = true;
    }
  }

  const paceDeviation = Math.abs(paceForDeviation - zoneMid) / halfWidth;
  const paceScoreRaw = scoreFromDeviation(paceDeviation, 4.0, 2.5, 0.5);

  let paceReason: string;
  if (usedEasyHrMidpoint) {
    paceReason = `Pace ${paceKmStr(activity.avgPaceSecKm)} was faster than your Easy zone lower bound (${paceKmStr(zoneLo)}), but HR ${activity.avgHeartRate} bpm is ≤ ${Math.round(0.75 * s.maxHR)} bpm (75% of max HR ${s.maxHR}) — scored as if at the Easy zone midpoint (${paceKmStr(zoneMid)}).`;
  } else {
    const rel =
      paceForDeviation < zoneMid - halfWidth * 0.15
        ? "near the fast edge"
        : paceForDeviation > zoneMid + halfWidth * 0.15
          ? "near the slow edge"
          : "close to the centre";
    paceReason = `Pace ${paceKmStr(activity.avgPaceSecKm)} was ${rel} of your ${runTypeLabel(runType)} zone (${zoneStr}).`;
  }

  // ── 2. Effort (max 3.0) + reason ───────────────────────────────────────────
  const hr = activity.avgHeartRate;
  let effortScoreRaw: number;
  let effortReason: string;
  if (hr == null || hr <= 0) {
    effortScoreRaw = 1.5;
    effortReason = "No average heart rate recorded — neutral score applied.";
  } else {
    const maxHR = Math.max(1, s.maxHR);
    const [fLo, fHi] = hrFracZone(runType);
    const bpmLo = fLo * maxHR;
    const bpmHi = fHi * maxHR;
    const mid = (bpmLo + bpmHi) / 2;
    const half = Math.max(1e-6, (bpmHi - bpmLo) / 2);
    const dev = Math.abs(hr - mid) / half;
    effortScoreRaw = scoreFromDeviation(dev, 3.0, 2.0, 0.5);
    const vs =
      hr > mid + half * 0.1
        ? "above"
        : hr < mid - half * 0.1
          ? "below"
          : "close to";
    effortReason = `HR ${hr} bpm was ${vs} the ${runTypeLabel(runType)} zone midpoint (${Math.round(bpmLo)}–${Math.round(bpmHi)} bpm from max HR ${maxHR}).`;
  }

  // ── 3. Distance (max 2.0) + reason ────────────────────────────────────────
  const dists = recentActivities
    .filter((r) => r.id !== activity.id)
    .map((r) => r.distanceKm)
    .filter((d) => d > 0);
  let distanceScoreRaw: number;
  let distanceReason: string;
  if (dists.length < 3) {
    distanceScoreRaw = 1.0;
    distanceReason = `Not enough prior ${runTypeLabel(runType)} runs yet to calculate a benchmark — neutral score applied (${dists.length} of 3 needed).`;
  } else if (dists.length < 5) {
    distanceScoreRaw = 1.2;
    distanceReason = `Early ${runTypeLabel(runType)} benchmark signal from ${dists.length} prior runs — partial credit applied until 5 runs are available.`;
  } else {
    const bench = median(dists);
    const ratio = bench > 0 ? activity.distanceKm / bench : 0;
    distanceScoreRaw = Math.min(2.0, distanceScoreFromRatio(ratio));
    distanceReason = `Your ${activity.distanceKm.toFixed(2)} km vs median ${bench.toFixed(2)} km from ${dists.length} prior ${runTypeLabel(runType)} runs (ratio ${ratio.toFixed(2)}).`;
  }

  // ── 4. Conditions (max 1.0) + reason ─────────────────────────────────────
  const t = activity.temperatureC;
  let conditionsScoreRaw: number;
  let conditionsReason: string;
  if (t == null || Number.isNaN(t)) {
    conditionsScoreRaw = 0.5;
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
    conditionsScoreRaw = Math.min(1.0, 0.8 + bonus);
    const humDisp = h != null && !Number.isNaN(h) ? `${h.toFixed(0)}%` : "—";
    if (bonus === 0) {
      conditionsReason = `Normal conditions (${t.toFixed(1)}°C, ${humDisp}) — base score 0.8.`;
    } else {
      const label = t > 28 ? "Hot conditions" : "Humid conditions";
      conditionsReason = `${label} (${t.toFixed(1)}°C, ${humDisp}) — ${bonusParts.join(", ")} → ${Math.min(1.0, 0.8 + bonus).toFixed(1)}.`;
    }
  }

  const pace = round1(paceScoreRaw);
  const effort = round1(effortScoreRaw);
  const distance = round1(distanceScoreRaw);
  const conditions = round1(conditionsScoreRaw);
  const total = round1(Math.max(0, Math.min(10, pace + effort + distance + conditions)));
  const band = ratingBand(total);

  return {
    total,
    band,
    components: {
      pace:       { score: pace,       max: 4.0, reason: paceReason },
      effort:     { score: effort,     max: 3.0, reason: effortReason },
      distance:   { score: distance,   max: 2.0, reason: distanceReason },
      conditions: { score: conditions, max: 1.0, reason: conditionsReason },
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
): RunType {
  if (avgPaceSecKm <= intervalPaceMaxSec) return "interval";
  if (avgPaceSecKm <= tempoPaceMaxSec) return "tempo";
  if (distanceKm >= 15) return "long";
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
  const planStart = getEffectivePlanStart(settings.planStartDate);
  return resolveRunSession(run, plan, planStart)?.type ?? inferRunType(run, settings);
}

/** Resolves the planned target pace for a run and returns seconds per km, or null when unmatched. */
export function resolveTargetPaceSecKm(run: StatActivity, plan: TrainingWeek[], settings: UserSettings): number | null {
  const planStart = getEffectivePlanStart(settings.planStartDate);
  const session = resolveRunSession(run, plan, planStart);
  return session ? Math.round(session.targetPaceMinPerKm * 60) : null;
}
