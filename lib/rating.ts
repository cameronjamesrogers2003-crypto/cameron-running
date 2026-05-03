import type { RunType, TrainingWeek } from "@/data/trainingPlan";
import { getPlanWeekForDate, getSessionDate } from "@/lib/planUtils";
import { startOfDayAEST, toAEST } from "@/lib/dateUtils";
import { TARGET_HM_PACE, STARTING_TEMPO_PACE } from "@/lib/constants";

export type { RunType };

// Minimal activity shape used by all pure stat functions
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

export interface AppSettings {
  targetHmPace?: number;
  startingTempoPace?: number;
}

export interface RunnerRatingResult {
  total: number;
  consistency: number;
  progress: number;
  longRuns: number;
  injuryFree: number;
  extras: number;
  injuryFreeWeeks: number;
}

export interface HMReadinessResult {
  total: number;
  pace: number;
  consistency: number;
  longRun: number;
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
}

export interface RatingResult {
  total: number;      // 0–10
  pace: number;       // 0–2.5
  effort: number;     // 0–2.5
  distance: number;   // 0–2.5
  conditions: number; // 0–2.5
}

// Target distance by run type (km)
const TARGET_DIST: Record<RunType, number> = {
  easy: 7,
  tempo: 10,
  interval: 8,
  long: 18,
};

// Ideal HR zone as fraction of max HR [low, high]
const HR_ZONE: Record<RunType, [number, number]> = {
  easy:     [0.60, 0.75],
  tempo:    [0.78, 0.88],
  interval: [0.88, 0.96],
  long:     [0.62, 0.78],
};

// Target pace by run type (sec/km)
const TARGET_PACE: Record<RunType, number> = {
  easy:     390, // 6:30/km
  tempo:    348, // 5:48/km
  interval: 300, // 5:00/km
  long:     420, // 7:00/km
};

export function calculateRunRating(input: RatingInput): RatingResult {
  const {
    distanceKm,
    avgPaceSecKm,
    avgHeartRate,
    temperatureC,
    humidityPct,
    runType,
    personalBestPaceSecKm,
    athleteAgeYears,
  } = input;

  // ── Pace (2.5 pts) ───────────────────────────────────────────────────────
  // 60% vs target pace, 40% vs personal best pace
  // Full score within ±30 sec/km (0.5 min/km) of target
  const targetPace = TARGET_PACE[runType];
  const pbPace = personalBestPaceSecKm ?? targetPace;

  const diffTarget = avgPaceSecKm - targetPace; // positive = slower
  const diffPB = avgPaceSecKm - pbPace;

  const targetScore = Math.max(0, Math.min(1, 1 - diffTarget / 30));
  const pbScore = diffPB <= 0 ? 1 : Math.max(0, 1 - diffPB / 60);

  const pace = (0.6 * targetScore + 0.4 * pbScore) * 2.5;

  // ── Effort / HR (2.5 pts) ────────────────────────────────────────────────
  let effort = 1.25; // neutral when no HR data
  if (avgHeartRate) {
    const age = athleteAgeYears ?? 23;
    const maxHR = 220 - age;
    const hrFrac = avgHeartRate / maxHR;
    const [zLow, zHigh] = HR_ZONE[runType];
    const zMid = (zLow + zHigh) / 2;
    const zHalf = (zHigh - zLow) / 2;
    const hrScore = Math.max(0, Math.min(1, 1 - Math.abs(hrFrac - zMid) / zHalf));
    effort = hrScore * 2.5;
  }

  // ── Distance (2.5 pts) ───────────────────────────────────────────────────
  // Scales against type target. Bonus up to 20% for exceeding.
  const targetDist = TARGET_DIST[runType];
  let ratio = distanceKm / targetDist;
  if (ratio > 1) ratio = 1 + Math.min(0.2, (ratio - 1) * 0.2);
  const distance = Math.min(2.5, (ratio / 1.2) * 2.5);

  // ── Conditions (2.5 pts) ─────────────────────────────────────────────────
  // Full 2.5 pts below 22°C apparent temp, scales to 0.8 at 38°C+
  let conditions = 1.5; // neutral when no weather data
  if (temperatureC !== null && temperatureC !== undefined) {
    let apparent = temperatureC;
    if (humidityPct !== null && humidityPct !== undefined && humidityPct > 40) {
      apparent += (humidityPct - 40) * 0.1;
    }
    if (apparent <= 22) {
      conditions = 2.5;
    } else if (apparent >= 38) {
      conditions = 0.8;
    } else {
      conditions = 2.5 - ((apparent - 22) / 16) * (2.5 - 0.8);
    }
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

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function aestDateKey(date: Date): string {
  const a = toAEST(date);
  return `${a.getUTCFullYear()}-${String(a.getUTCMonth() + 1).padStart(2, "0")}-${String(a.getUTCDate()).padStart(2, "0")}`;
}

// ── inferRunType ─────────────────────────────────────────────────────────────
// HR-aware run type inference. Falls back to pace-only when HR is absent.

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

// ── resolveRunType ───────────────────────────────────────────────────────────
// Returns the plan session type when the run date matches a plan session date
// (AEST day comparison), otherwise falls back to inferRunType.

export function resolveRunType(run: StatActivity, plan: TrainingWeek[]): RunType {
  const runDate = new Date(run.date);
  const weekNum = getPlanWeekForDate(runDate);

  if (weekNum > 0 && weekNum <= plan.length) {
    const planWeek = plan[weekNum - 1];
    for (const session of planWeek.sessions) {
      const sessionDate = getSessionDate(weekNum, session.day);
      // Compare AEST calendar days
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

// ── calculateRunnerRating ────────────────────────────────────────────────────

export function calculateRunnerRating(
  runs: StatActivity[],
  plan: TrainingWeek[],
  pbPaceSecKm?: number | null,
  athleteAgeYears = 23,
  referenceDate?: Date
): RunnerRatingResult {
  const today        = referenceDate ?? new Date();
  const todayMidnight = startOfDayAEST(today);
  const MS            = 24 * 60 * 60 * 1000;

  const past28 = new Date(todayMidnight.getTime() - 28 * MS);
  const past42 = new Date(todayMidnight.getTime() - 42 * MS);

  // Build plan session date sets
  const planDates4     = new Set<string>(); // last 28 days
  const planLongDates6 = new Set<string>(); // long-run sessions, last 42 days
  const planDates6     = new Set<string>(); // all sessions, last 42 days

  for (const planWeek of plan) {
    for (const session of planWeek.sessions) {
      const sd = getSessionDate(planWeek.week, session.day);
      if (sd >= todayMidnight) continue;
      const key = aestDateKey(sd);
      if (sd >= past28) planDates4.add(key);
      if (sd >= past42) {
        planDates6.add(key);
        if (session.type === "long") planLongDates6.add(key);
      }
    }
  }

  function runKey(r: StatActivity) { return aestDateKey(new Date(r.date)); }

  const pastRuns    = runs.filter(r => new Date(r.date) < todayMidnight);
  const runsLast28  = pastRuns.filter(r => new Date(r.date) >= past28);
  const runsLast42  = pastRuns.filter(r => new Date(r.date) >= past42);
  const runKeys28   = new Set(runsLast28.map(runKey));
  const runKeys42   = new Set(runsLast42.map(runKey));

  // ── Consistency ──────────────────────────────────────────────────────────
  let completedLast4Weeks = 0;
  for (const k of planDates4) { if (runKeys28.has(k)) completedLast4Weeks++; }
  const allWeeksComplete   = planDates4.size >= 12 && completedLast4Weeks === planDates4.size;
  const consistencyScore   = clamp((completedLast4Weeks / 12) * 20 + (allWeeksComplete ? 1 : 0), 0, 20);

  // ── Progress ─────────────────────────────────────────────────────────────
  const byDateDesc = [...pastRuns].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const last4Runs  = byDateDesc.slice(0, 4);
  const prior4Runs = byDateDesc.slice(4, 8);

  function avgR(rs: StatActivity[]): number {
    if (!rs.length) return 5;
    return rs.reduce((s, r) => {
      const type = resolveRunType(r, plan);
      return s + calculateRunRating({
        distanceKm: r.distanceKm, avgPaceSecKm: r.avgPaceSecKm,
        avgHeartRate: r.avgHeartRate, temperatureC: r.temperatureC,
        humidityPct: r.humidityPct, runType: type,
        personalBestPaceSecKm: pbPaceSecKm ?? null, athleteAgeYears,
      }).total;
    }, 0) / rs.length;
  }

  const progressScore = clamp(10 + (avgR(last4Runs) - avgR(prior4Runs)) * 5, 0, 20);

  // ── Long runs ─────────────────────────────────────────────────────────────
  let completedLong = 0;
  for (const k of planLongDates6) { if (runKeys42.has(k)) completedLong++; }
  const longRunScore = planLongDates6.size > 0
    ? clamp((completedLong / planLongDates6.size) * 25, 0, 25)
    : 12.5;

  // ── Injury-free ───────────────────────────────────────────────────────────
  // Build flat list of past plan sessions in chronological order: sat, sun, wed per week
  const DAY_ORDER: Record<string, number> = { sat: 0, sun: 1, wed: 2 };
  type SS = { weekNum: number; done: boolean };
  const sessionList: SS[] = [];

  for (const planWeek of plan) {
    const sorted = [...planWeek.sessions].sort((a, b) => DAY_ORDER[a.day] - DAY_ORDER[b.day]);
    for (const session of sorted) {
      const sd = getSessionDate(planWeek.week, session.day);
      if (sd >= todayMidnight) continue;
      sessionList.push({
        weekNum: planWeek.week,
        done: (pastRuns.some(r => aestDateKey(new Date(r.date)) === aestDateKey(sd))),
      });
    }
  }

  // Find most recent consecutive double-miss; count weeks after it
  let breakAtWeek = 0;
  for (let i = sessionList.length - 1; i > 0; i--) {
    if (!sessionList[i].done && !sessionList[i - 1].done) {
      breakAtWeek = sessionList[i].weekNum;
      break;
    }
  }

  let injuryFreeWeeks = 0;
  if (breakAtWeek === 0) {
    const activeWeeks = new Set(sessionList.map(s => s.weekNum));
    injuryFreeWeeks = activeWeeks.size;
  } else {
    const weeksAfter = new Set(sessionList.filter(s => s.weekNum > breakAtWeek).map(s => s.weekNum));
    injuryFreeWeeks = weeksAfter.size;
  }

  const injuryFreeScore = clamp((injuryFreeWeeks / 8) * 20, 0, 20);

  // ── Extras ────────────────────────────────────────────────────────────────
  // Plan session AEST days-of-week: Sat=6, Sun=0, Wed=3
  const PLAN_DOW = new Set([0, 3, 6]);
  const extraRunsLast4Weeks = runsLast28.filter(r => {
    const dow = toAEST(new Date(r.date)).getUTCDay();
    return !PLAN_DOW.has(dow);
  }).length;
  const extrasScore = clamp(extraRunsLast4Weeks * 2.5, 0, 15);

  const total = Math.min(100, Math.round(consistencyScore + progressScore + longRunScore + injuryFreeScore + extrasScore));

  return {
    total,
    consistency:     round1(consistencyScore),
    progress:        round1(progressScore),
    longRuns:        round1(longRunScore),
    injuryFree:      round1(injuryFreeScore),
    extras:          round1(extrasScore),
    injuryFreeWeeks,
  };
}

// ── calculateHMReadiness ─────────────────────────────────────────────────────

export function calculateHMReadiness(
  runs: StatActivity[],
  plan: TrainingWeek[],
  settings: AppSettings = {}
): HMReadinessResult {
  const targetPace   = settings.targetHmPace      ?? TARGET_HM_PACE;
  const startingPace = settings.startingTempoPace ?? STARTING_TEMPO_PACE;

  const todayMidnight = startOfDayAEST(new Date());
  const past42        = new Date(todayMidnight.getTime() - 42 * 24 * 60 * 60 * 1000);
  const pastRuns      = runs.filter(r => new Date(r.date) < todayMidnight && new Date(r.date) >= past42);

  // ── Pace readiness ────────────────────────────────────────────────────────
  const tempoRuns = pastRuns
    .filter(r => resolveRunType(r, plan) === "tempo")
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 3);

  let paceReadiness = 0;
  if (tempoRuns.length > 0) {
    const avgPace = tempoRuns.reduce((s, r) => s + r.avgPaceSecKm / 60, 0) / tempoRuns.length;
    paceReadiness = clamp((startingPace - avgPace) / (startingPace - targetPace), 0, 1);
  }

  // ── Consistency readiness ─────────────────────────────────────────────────
  const planDates6 = new Set<string>();
  for (const planWeek of plan) {
    for (const session of planWeek.sessions) {
      const sd = getSessionDate(planWeek.week, session.day);
      if (sd < todayMidnight && sd >= past42) planDates6.add(aestDateKey(sd));
    }
  }

  let completed6 = 0;
  for (const k of planDates6) {
    if (pastRuns.some(r => aestDateKey(new Date(r.date)) === k)) completed6++;
  }
  const consistencyReadiness = planDates6.size > 0 ? clamp(completed6 / planDates6.size, 0, 1) : 0;

  // ── Long run readiness ────────────────────────────────────────────────────
  const longestRun      = pastRuns.reduce((m, r) => Math.max(m, r.distanceKm), 0);
  const longRunReadiness = clamp(longestRun / 21, 0, 1);

  const total = Math.round(((paceReadiness + consistencyReadiness + longRunReadiness) / 3) * 100);

  return {
    total,
    pace:        Math.round(paceReadiness * 100),
    consistency: Math.round(consistencyReadiness * 100),
    longRun:     Math.round(longRunReadiness * 100),
  };
}
