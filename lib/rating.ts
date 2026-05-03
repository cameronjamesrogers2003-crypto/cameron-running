import type { RunType, TrainingWeek } from "@/data/trainingPlan";
import { getPlanWeekForDate, getSessionDate } from "@/lib/planUtils";
import { toAEST } from "@/lib/dateUtils";

export type { RunType };

export interface StatActivity {
  id: string;
  date: Date | string;
  distanceKm: number;
  avgPaceSecKm: number;
  avgHeartRate?: number | null;
  maxHeartRate?: number | null;
  temperatureC?: number | null;
  humidityPct?: number | null;
}

export interface RatingInput {
  distanceKm: number;
  avgPaceSecKm: number;
  avgHeartRate: number | null | undefined;
  temperatureC?: number | null;
  humidityPct?: number | null;
  runType: RunType;
  personalBestPaceSecKm?: number | null;
  athleteAgeYears?: number;
  maxHROverride?: number | null;
  distTargetKmOverride?: number | null;
}

export interface RatingResult {
  total: number;
  pace: number;
  effort: number;
  distance: number;
  conditions: number;
}

// Default target distance by run type (km) — overridden by distTargetKmOverride
const TARGET_DIST: Record<RunType, number> = {
  easy: 7,
  tempo: 10,
  interval: 8,
  long: 18,
};

const HR_ZONE: Record<RunType, [number, number]> = {
  easy:     [0.60, 0.75],
  tempo:    [0.78, 0.88],
  interval: [0.88, 0.96],
  long:     [0.62, 0.78],
};

const TARGET_PACE: Record<RunType, number> = {
  easy:     390,
  tempo:    348,
  interval: 300,
  long:     420,
};

export function calculateRunRating(input: RatingInput): RatingResult {
  const {
    distanceKm, avgPaceSecKm, avgHeartRate,
    temperatureC, humidityPct, runType,
    personalBestPaceSecKm, athleteAgeYears,
    maxHROverride, distTargetKmOverride,
  } = input;

  // ── Pace (2.5 pts) ───────────────────────────────────────────────────────
  const targetPace = TARGET_PACE[runType];
  const pbPace     = personalBestPaceSecKm ?? targetPace;

  const diffTarget = avgPaceSecKm - targetPace;
  const diffPB     = avgPaceSecKm - pbPace;

  const targetScore = Math.max(0, Math.min(1, 1 - diffTarget / 30));
  const pbScore     = diffPB <= 0 ? 1 : Math.max(0, 1 - diffPB / 60);
  const pace        = (0.6 * targetScore + 0.4 * pbScore) * 2.5;

  // ── Effort / HR (2.5 pts) ────────────────────────────────────────────────
  let effort = 1.25;
  if (avgHeartRate) {
    const age   = athleteAgeYears ?? 23;
    const maxHR = maxHROverride ?? (220 - age);
    const hrFrac = avgHeartRate / maxHR;
    const [zLow, zHigh] = HR_ZONE[runType];
    const zMid  = (zLow + zHigh) / 2;
    const zHalf = (zHigh - zLow) / 2;
    effort = Math.max(0, Math.min(1, 1 - Math.abs(hrFrac - zMid) / zHalf)) * 2.5;
  }

  // ── Distance (2.5 pts) ───────────────────────────────────────────────────
  const targetDist = distTargetKmOverride ?? TARGET_DIST[runType];
  let ratio = distanceKm / targetDist;
  if (ratio > 1) ratio = 1 + Math.min(0.2, (ratio - 1) * 0.2);
  const distance = Math.min(2.5, (ratio / 1.2) * 2.5);

  // ── Conditions (2.5 pts) ─────────────────────────────────────────────────
  let conditions = 1.5;
  if (temperatureC !== null && temperatureC !== undefined) {
    let apparent = temperatureC;
    if (humidityPct !== null && humidityPct !== undefined && humidityPct > 40) {
      apparent += (humidityPct - 40) * 0.1;
    }
    if (apparent <= 22)      conditions = 2.5;
    else if (apparent >= 38) conditions = 0.8;
    else                     conditions = 2.5 - ((apparent - 22) / 16) * (2.5 - 0.8);
  }

  const total = Math.max(0, Math.min(10, pace + effort + distance + conditions));

  return {
    total:      round1(total),
    pace:       round1(pace),
    effort:     round1(effort),
    distance:   round1(distance),
    conditions: round1(conditions),
  };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function aestDateKey(date: Date): string {
  const a = toAEST(date);
  return `${a.getUTCFullYear()}-${String(a.getUTCMonth() + 1).padStart(2, "0")}-${String(a.getUTCDate()).padStart(2, "0")}`;
}

export function inferRunType(run: StatActivity): RunType {
  const paceMinPerKm = run.avgPaceSecKm / 60;
  const distKm       = run.distanceKm;

  if (distKm >= 15) return "long";

  if (run.avgHeartRate && run.maxHeartRate) {
    const hrPct = run.avgHeartRate / run.maxHeartRate;
    if (hrPct >= 0.88 || paceMinPerKm <= 5.1) return "interval";
    if (hrPct >= 0.78 || paceMinPerKm <= 5.4) return "tempo";
    return "easy";
  }

  if (paceMinPerKm <= 5.1) return "interval";
  if (paceMinPerKm <= 5.4) return "tempo";
  return "easy";
}

export function resolveRunType(run: StatActivity, plan: TrainingWeek[]): RunType {
  const runDate = new Date(run.date);
  const weekNum = getPlanWeekForDate(runDate);

  if (weekNum > 0 && weekNum <= plan.length) {
    const planWeek = plan[weekNum - 1];
    for (const session of planWeek.sessions) {
      const sessionDate = getSessionDate(weekNum, session.day);
      const ra = toAEST(runDate);
      const sa = toAEST(sessionDate);
      if (
        ra.getUTCFullYear() === sa.getUTCFullYear() &&
        ra.getUTCMonth()    === sa.getUTCMonth()    &&
        ra.getUTCDate()     === sa.getUTCDate()
      ) {
        return session.type;
      }
    }
  }

  return inferRunType(run);
}

export { aestDateKey };
