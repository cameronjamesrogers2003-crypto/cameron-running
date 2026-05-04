import type { RunType, Session, TrainingWeek } from "@/data/trainingPlan";
import { getPlanWeekForDate, getSessionDate } from "@/lib/planUtils";
import { sameDayAEST } from "@/lib/dateUtils";
import { DEFAULT_SETTINGS, type UserSettings } from "@/lib/settings";

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
  /** Persisted 0–10 rating; optional when not yet loaded from DB. */
  rating?: number | null;
  /** Pace-zone classification persisted on Activity; optional for legacy rows. */
  classifiedRunType?: string | null;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

/**
 * Score from deviation where 0 = centre, 1 = first ring, 2 = second ring, >2 = out.
 * Anchors: (0, a0), (1, a1), (2, a2), (>2, 0). Piecewise linear.
 */
function scoreFromDeviation(deviation: number, a0: number, a1: number, a2: number): number {
  if (deviation <= 0) return a0;
  if (deviation <= 1) return a0 + (a1 - a0) * deviation;
  if (deviation <= 2) return a1 + (a2 - a1) * (deviation - 1);
  return 0;
}

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

/** HR fraction zones as fraction of maxHR (0–1). Long uses same aerobic band as easy. */
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

function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? s[m]! : ((s[m - 1]! + s[m]!) / 2);
}

/**
 * Distance score (max 2.0): ratio = actual / median benchmark of recent same-type runs.
 * ratio ≥ 1.2 → 2.0; ratio 1.0 → 1.5; ratio 0.5 → 0.75; ratio 0 → 0; linear between anchors.
 */
function distanceScoreFromRatio(ratio: number): number {
  if (ratio >= 1.2) return 2.0;
  if (ratio >= 1.0) return 1.5 + (2.0 - 1.5) * ((ratio - 1.0) / 0.2);
  if (ratio >= 0.5) return 0.75 + (1.5 - 0.75) * ((ratio - 0.5) / 0.5);
  if (ratio > 0) return 0.75 * (ratio / 0.5);
  return 0;
}

/**
 * Run quality score (0–10), independent of the training plan.
 *
 * Weights:
 *   1. Pace quality — max 4.0
 *      - Target band from UserSettings pace zones for the classified run type
 *      (easy / tempo / interval / long: min–max sec/km).
 *      - Midpoint of band; deviation = |actual − midpoint| / (half band width).
 *      - deviation 0 → 4.0; 1 → 2.5; 2 → 0.5; >2 → 0 (linear between).
 *      - Easy-only: if classified easy and pace faster than easy **lower** bound
 *        (avgPaceSecKm < easyPaceMinSec), treat pace as midpoint when
 *        avgHR ≤ 0.75×maxHR; otherwise apply normal deviation penalty.
 *
 *   2. Effort / HR appropriateness — max 3.0
 *      - Easy/long: 60–75% maxHR; Tempo: 80–90%; Interval: 90–100%.
 *      - Same deviation curve with anchors 3.0 / 2.0 / 0.5 / 0.
 *      - Missing HR → 1.5 neutral.
 *
 *   3. Distance — max 2.0
 *      - Benchmark = median km of `recentActivities` (same classified type).
 *      - Fewer than 3 prior runs of that type → 1.0 neutral.
 *      - Else score from ratio actual / benchmark (see distanceScoreFromRatio), cap 2.0.
 *
 *   4. Conditions — max 1.0
 *      - No temp → 0.5 neutral.
 *      - Else base 1.0 + heat (T>28: +0.1/° capped +0.3) + humidity (>80: +0.1 per 5% capped +0.2);
 *        final min(..., 1.0).
 *
 * Total is clamped to [0, 10] and rounded to 1 decimal.
 */
export function calculateRunRating(
  activity: StatActivity,
  settings: UserSettings,
  recentActivities: StatActivity[],
): number {
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

  // ── 1. Pace (max 4.0) ─────────────────────────────────────────────────
  let paceForDeviation = activity.avgPaceSecKm;
  if (
    runType === "easy"
    && activity.avgPaceSecKm < zoneLo
    && activity.avgHeartRate != null
    && activity.avgHeartRate > 0
  ) {
    const maxHR = s.maxHR;
    const hrFrac = activity.avgHeartRate / maxHR;
    if (hrFrac <= 0.75) paceForDeviation = zoneMid;
  }

  const paceDeviation = Math.abs(paceForDeviation - zoneMid) / halfWidth;
  const paceScore = scoreFromDeviation(paceDeviation, 4.0, 2.5, 0.5);

  // ── 2. Effort (max 3.0) ────────────────────────────────────────────────
  let effortScore = 1.5;
  const hr = activity.avgHeartRate;
  if (hr != null && hr > 0) {
    const maxHR = Math.max(1, s.maxHR);
    const [fLo, fHi] = hrFracZone(runType);
    const bpmLo = fLo * maxHR;
    const bpmHi = fHi * maxHR;
    const mid = (bpmLo + bpmHi) / 2;
    const half = Math.max(1e-6, (bpmHi - bpmLo) / 2);
    const dev = Math.abs(hr - mid) / half;
    effortScore = scoreFromDeviation(dev, 3.0, 2.0, 0.5);
  }

  // ── 3. Distance (max 2.0) ────────────────────────────────────────────────
  let distanceScore = 1.0;
  const dists = recentActivities
    .filter((r) => r.id !== activity.id)
    .map((r) => r.distanceKm)
    .filter((d) => d > 0);
  if (dists.length >= 3) {
    const bench = median(dists);
    if (bench > 0) {
      const ratio = activity.distanceKm / bench;
      distanceScore = Math.min(2.0, distanceScoreFromRatio(ratio));
    }
  }

  // ── 4. Conditions (max 1.0) ─────────────────────────────────────────────
  let conditionsScore = 0.5;
  const t = activity.temperatureC;
  if (t != null && !Number.isNaN(t)) {
    let bonus = 0;
    if (t > 28) bonus += Math.min(0.3, (t - 28) * 0.1);
    const h = activity.humidityPct;
    if (h != null && !Number.isNaN(h) && h > 80) {
      bonus += Math.min(0.2, Math.floor((h - 80) / 5) * 0.1);
    }
    conditionsScore = Math.min(1.0, 1.0 + bonus);
  }

  const total = Math.max(0, Math.min(10, paceScore + effortScore + distanceScore + conditionsScore));
  return round1(total);
}

/**
 * Pace-zone classification (manual pace zone thresholds + 15 km long rule).
 */
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

export function resolveRunSession(run: StatActivity, plan: TrainingWeek[]): Session | null {
  const runDate = new Date(run.date);
  const weekNum = getPlanWeekForDate(runDate);

  if (weekNum <= 0 || weekNum > plan.length) return null;

  const planWeek = plan[weekNum - 1];
  for (const session of planWeek.sessions) {
    const sessionDate = getSessionDate(weekNum, session.day);
    if (sameDayAEST(runDate, sessionDate)) return session;
  }

  return null;
}

export function resolveRunType(run: StatActivity, plan: TrainingWeek[], settings: UserSettings = DEFAULT_SETTINGS): RunType {
  return resolveRunSession(run, plan)?.type ?? inferRunType(run, settings);
}

export function resolveTargetPaceSecKm(run: StatActivity, plan: TrainingWeek[]): number | null {
  const session = resolveRunSession(run, plan);
  return session ? Math.round(session.targetPaceMinPerKm * 60) : null;
}
