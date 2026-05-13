import { getSessionPaces } from "@/lib/planPaces";
import { getNovicePeakWeeklyKm, getNoviceRunWalkTransitionWeek, getNoviceTempoWindowStart, isNoviceBridgeTempoWeek } from "@/lib/novicePlanCaps";
import type { Day, Phase, PlanConfig, PlanPaceAdjust, RunType, Session, TrainingWeek } from "@/data/trainingPlan";
import type { GeneratedPlanBundle } from "@/types/generatedPlan";
import { defaultNoviceRuntimeState } from "@/types/generatedPlan";

export {
  getNovicePeakWeeklyKm,
  getNoviceRunWalkTransitionWeek,
  getNoviceTempoWindowStart,
  getNoviceTempoWindowEnd,
  isNoviceBridgeTempoWeek,
} from "@/lib/novicePlanCaps";

const DAY_INDEX: Record<Day, number> = {
  mon: 0,
  tue: 1,
  wed: 2,
  thu: 3,
  fri: 4,
  sat: 5,
  sun: 6,
};

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Half / full marathon long-run integrity (12+ weeks, B/I/A only). */
function longRunIntegrityScope(config: Pick<PlanConfig, "level" | "goal" | "weeks">): boolean {
  if (config.level === "NOVICE" || config.level === "ELITE") return false;
  if (config.goal !== "hm" && config.goal !== "full") return false;
  if (config.weeks < 12) return false;
  return (
    config.level === "BEGINNER" ||
    config.level === "INTERMEDIATE" ||
    config.level === "ADVANCED"
  );
}

function getMinLongRunKm(level: PlanConfig["level"], goal: PlanConfig["goal"]): number {
  if (goal === "hm") {
    switch (level) {
      case "BEGINNER":
        return 8;
      case "INTERMEDIATE":
        return 10;
      case "ADVANCED":
        return 12;
      default:
        return 0;
    }
  }
  if (goal === "full") {
    switch (level) {
      case "BEGINNER":
        return 12;
      case "INTERMEDIATE":
        return 14;
      case "ADVANCED":
        return 16;
      default:
        return 0;
    }
  }
  return 0;
}

function getSessionCountVolumeMultiplier(sessionCount: number): number {
  switch (sessionCount) {
    case 2:
      return 0.8;
    case 3:
      return 1.0;
    case 4:
      return 1.2;
    case 5:
      return 1.35;
    case 6:
      return 1.5;
    default:
      return 1.0;
  }
}

function getEasySessionMinimum(level: PlanConfig["level"]): number {
  switch (level) {
    case "BEGINNER":
      return 4;
    case "INTERMEDIATE":
      return 5;
    case "ADVANCED":
      return 6;
    default:
      return 4;
  }
}

function getQualitySessionKm(
  type: "tempo" | "interval",
  eachOtherRef: number,
  minSessionKm: number,
  nonLongCap: number,
  intervalCap: number,
): number {
  if (type === "interval") {
    return round1(clamp(eachOtherRef, minSessionKm, Math.min(intervalCap, nonLongCap)));
  }
  return round1(clamp(eachOtherRef, minSessionKm, Math.max(minSessionKm, nonLongCap)));
}

function sumQualityDistanceKm(
  otherDays: Day[],
  typesForWeek: Record<Day, RunType>,
  splitRef: number,
  minSessionKm: number,
  nonLongCap: number,
  intervalCap: number,
): number {
  let sum = 0;
  for (const d of otherDays) {
    const t = typesForWeek[d];
    if (t === "tempo") {
      sum += getQualitySessionKm("tempo", splitRef, minSessionKm, nonLongCap, intervalCap);
    } else if (t === "interval") {
      sum += getQualitySessionKm("interval", splitRef, minSessionKm, nonLongCap, intervalCap);
    }
  }
  return sum;
}

function maxQualityDistanceKm(
  otherDays: Day[],
  typesForWeek: Record<Day, RunType>,
  splitRef: number,
  minSessionKm: number,
  nonLongCap: number,
  intervalCap: number,
): number {
  let m = 0;
  for (const d of otherDays) {
    const t = typesForWeek[d];
    if (t === "tempo" || t === "interval") {
      m = Math.max(
        m,
        getQualitySessionKm(t, splitRef, minSessionKm, nonLongCap, intervalCap),
      );
    }
  }
  return m;
}

function chronicWeeklyKmAvg(history: number[]): number {
  if (history.length === 0) return 0;
  const tail = history.slice(-4);
  return tail.reduce((a, b) => a + b, 0) / tail.length;
}

export function weekAcuteToChronicOk(
  acute: number,
  weekNumber: number,
  history: number[],
  weeklyRamp: number[],
): boolean {
  if (weekNumber <= 4) return true;
  const chActual = chronicWeeklyKmAvg(history);
  const prevRamp: number[] = [];
  for (let i = weekNumber - 5; i <= weekNumber - 2; i++) {
    if (i >= 0) prevRamp.push(weeklyRamp[i] ?? 0);
  }
  const chRamp = prevRamp.length ? prevRamp.reduce((a, b) => a + b, 0) / prevRamp.length : 0;
  const ch = Math.max(chActual, chRamp || chActual);
  if (!(ch > 0)) return true;
  return acute / ch <= 1.25 + 1e-9;
}

function uniqDays(days: Day[]): Day[] {
  const seen = new Set<Day>();
  const out: Day[] = [];
  for (const d of days) {
    if (!seen.has(d)) {
      seen.add(d);
      out.push(d);
    }
  }
  return out;
}

function daysSorted(days: Day[]): Day[] {
  return [...days].sort((a, b) => DAY_INDEX[a] - DAY_INDEX[b]);
}

function circularDayDistance(a: Day, b: Day): number {
  const raw = Math.abs(DAY_INDEX[a] - DAY_INDEX[b]);
  return Math.min(raw, 7 - raw);
}

const DAY_COUNT_MULTIPLIER: Record<number, number> = {
  2: 0.65,
  3: 1.0,
  4: 1.2,
  5: 1.4,
  6: 1.6,
};

function nearestTrainingDayDistance(day: Day, trainingSet: Set<Day>): number {
  // distance in days to closest other training day (0 if none / self only)
  if (trainingSet.size <= 1) return 0;
  let best = 7;
  for (const d of trainingSet) {
    if (d === day) continue;
    const dist = circularDayDistance(d, day);
    best = Math.min(best, dist);
  }
  return best === 7 ? 0 : best;
}

function isHard(t: RunType): boolean {
  return t === "tempo" || t === "interval";
}

export function hasConsecutiveHardSessions(
  days: Day[],
  assignment: Partial<Record<Day, RunType>>,
): boolean {
  const sorted = daysSorted(uniqDays(days));
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    if (Math.abs(DAY_INDEX[curr] - DAY_INDEX[prev]) !== 1) continue;
    const pt = assignment[prev];
    const ct = assignment[curr];
    if (pt && ct && isHard(pt) && isHard(ct)) return true;
  }
  return false;
}

function basePhaseForLevel(level: PlanConfig["level"]): Phase {
  switch (level) {
    case "NOVICE":
      return "Beginner Base";
    case "BEGINNER":
      return "Beginner Base";
    case "INTERMEDIATE":
      return "Intermediate Base";
    case "ADVANCED":
      return "Advanced Base";
    case "ELITE":
      return "Advanced Base";
    default:
      return "Beginner Base";
  }
}

function phaseForWeek(config: PlanConfig, week: number): Phase {
  const weeks = config.weeks;
  const goal = config.goal;

  // Derive base/build/taper boundaries.
  const structure = (() => {
    if (weeks === 8) {
      if (goal === "5k" || goal === "10k") {
        return { baseEnd: 3, buildEnd: 7, taperStart: 8 }; // Aggressive 1 week taper
      }
      return { baseEnd: 2, buildEnd: 6, taperStart: 7 };
    }
    if (weeks === 12) {
      if (goal === "5k" || goal === "10k") {
        return { baseEnd: 3, buildEnd: 10, taperStart: 11 }; // 2 week taper
      }
      return { baseEnd: 4, buildEnd: 9, taperStart: 10 }; // 3 week taper for HM/Full
    }
    if (weeks === 16) {
      if (goal === "5k" || goal === "10k") {
        return { baseEnd: 4, buildEnd: 14, taperStart: 15 }; // 2 week taper
      }
      return { baseEnd: 6, buildEnd: 13, taperStart: 14 }; // 3 week taper
    }
    // 20
    if (goal === "5k" || goal === "10k") {
      return { baseEnd: 6, buildEnd: 18, taperStart: 19 }; // 2 week taper
    }
    return { baseEnd: 8, buildEnd: 17, taperStart: 18 }; // 3 week taper
  })();

  if (week <= structure.baseEnd) return basePhaseForLevel(config.level);
  if (week >= structure.taperStart) return "Taper";
  return "Race Specific";
}

function getCutbackConfig(level: PlanConfig["level"]) {
  if (level === "NOVICE") return { every: 3, reduce: 0.25, maxIncrease: 0.10 };
  if (level === "BEGINNER") return { every: 3, reduce: 0.20, maxIncrease: 0.10 };
  if (level === "INTERMEDIATE") return { every: 4, reduce: 0.25, maxIncrease: 0.15 };
  if (level === "ADVANCED") return { every: 4, reduce: 0.30, maxIncrease: 0.20 };
  return { every: 4, reduce: 0.25, maxIncrease: 0.25 }; // ELITE
}

function getPeakWeeklyKm(level: PlanConfig["level"], goal: PlanConfig["goal"]): number {
  const key = `${level}-${goal}`;
  switch (key) {
    case "NOVICE-5k": return 20;
    case "NOVICE-10k": return 35;
    case "NOVICE-hm": return 40;
    case "NOVICE-full": return 55;
    case "BEGINNER-5k": return 30;
    case "BEGINNER-10k": return 40;
    case "BEGINNER-hm": return 45;
    case "BEGINNER-full": return 64;
    case "INTERMEDIATE-5k": return 40;
    case "INTERMEDIATE-10k": return 50;
    case "INTERMEDIATE-hm": return 65;
    case "INTERMEDIATE-full": return 84;
    case "ADVANCED-5k": return 60;
    case "ADVANCED-10k": return 75;
    case "ADVANCED-hm": return 90;
    case "ADVANCED-full": return 100;
    case "ELITE-5k": return 85;
    case "ELITE-10k": return 100;
    case "ELITE-hm": return 110;
    case "ELITE-full": return 130;
    default: return 45;
  }
}

function getStartWeeklyKm(level: PlanConfig["level"], peak: number): number {
  if (level === "NOVICE") return peak * 0.35;
  if (level === "BEGINNER") return peak * 0.60;
  if (level === "INTERMEDIATE") return peak * 0.70;
  return peak * 0.80;
}

/** Max share of weekly km on the long run for Novice 5K/10K (by sessions per week). */
function maxNoviceShortRaceLongRunFraction(sessionsPerWeek: number): number {
  switch (sessionsPerWeek) {
    case 2:
      return 0.5;
    case 3:
      return 0.4;
    case 4:
      return 0.34;
    case 5:
      return 0.3;
    case 6:
      return 0.28;
    default:
      return 0.35;
  }
}

const NOVICE_SHORT_MIN_LONG_KM = 1.5;
const NOVICE_SHORT_MIN_EASY_KM = 1.0;
const NOVICE_SHORT_MAX_EASY_KM = 4.0;

/**
 * Redistribute weekly km so the long run does not dominate (5K/10K Novice only).
 * Keeps total T = L + n*E where possible; may shrink T slightly if easy hits ceiling.
 */
function rebalanceNoviceShortRaceSessionKm(
  L: number,
  E: number,
  T: number,
  sessionsPerWeek: number,
): { L: number; E: number; T: number } {
  const n = sessionsPerWeek - 1;
  if (n < 1) return { L: round1(L), E: round1(E), T: round1(T) };

  const f = maxNoviceShortRaceLongRunFraction(sessionsPerWeek);
  if (L <= f * T + 0.02) {
    return { L: round1(L), E: round1(E), T: round1(L + n * E) };
  }

  let Ln = Math.min(L, f * T);
  let En = (T - Ln) / n;
  En = clamp(En, NOVICE_SHORT_MIN_EASY_KM, NOVICE_SHORT_MAX_EASY_KM);
  Ln = T - n * En;
  Ln = Math.max(NOVICE_SHORT_MIN_LONG_KM, Ln);
  En = (T - Ln) / n;
  En = clamp(En, NOVICE_SHORT_MIN_EASY_KM, NOVICE_SHORT_MAX_EASY_KM);
  Ln = T - n * En;
  Ln = Math.max(NOVICE_SHORT_MIN_LONG_KM, Ln);

  if (Ln > f * T + 0.02) {
    Ln = f * T;
    En = (T - Ln) / n;
    En = clamp(En, NOVICE_SHORT_MIN_EASY_KM, NOVICE_SHORT_MAX_EASY_KM);
    Ln = T - n * En;
    Ln = Math.max(NOVICE_SHORT_MIN_LONG_KM, Ln);
    En = (T - Ln) / n;
    En = clamp(En, NOVICE_SHORT_MIN_EASY_KM, NOVICE_SHORT_MAX_EASY_KM);
    Ln = T - n * En;
    Ln = Math.max(NOVICE_SHORT_MIN_LONG_KM, Ln);
  }

  const Tn = round1(Ln + n * En);
  return { L: round1(Ln), E: round1(En), T: Tn };
}

/** 
 * Returns Novice session distances for a given week using the bottom-up formula:
 * T[w] = L[w] + (config.days.length - 1) * E[w]
 */
function getNoviceWeeklyDistances(
  config: PlanConfig,
  w: number,
  lastNonTaperWeek: number,
  prevVolumesInput: number[] | null,
): { longKm: number; easyKm: number; totalKm: number } {
  const prevVolumes = prevVolumesInput || [];
  const { start: lrStart, peak: lrPeak } = getLongRunKm(config);
  const nonLongCount = config.days.length - 1;
  const prevTotal = prevVolumes.length > 0 ? prevVolumes[prevVolumes.length - 1] : null;
  
  // 1. Calculate base (pre-cutback/taper) session distances
  const progress = lastNonTaperWeek <= 1 ? 1 : clamp((w - 1) / (lastNonTaperWeek - 1), 0, 1);
  let L = lrStart + progress * (lrPeak - lrStart);
  let E = 1.0 + progress * (4.0 - 1.0);

  // Apply 50% Long Run Rule for 2-session weeks early: L <= E
  if (config.days.length === 2 && L > E + 0.01) {
    L = E;
  }

  const phase = phaseForWeek(config, w);
  const isTaper = phase === "Taper";
  const { every, reduce } = getCutbackConfig(config.level);
  const inFinalThree = w > config.weeks - 3;
  const isCutback = !inFinalThree && !isTaper && w % every === 0;

  // 2. Apply scaling (Cutback or Taper)
  if (isCutback) {
    L *= (1 - reduce);
    E *= (1 - reduce);
  } else if (isTaper) {
    // Taper scaling: ensure monotone non-increasing total
    const theoreticalPeakTotal = (config.days.length === 2 ? Math.min(lrPeak, 4.0) : lrPeak) + nonLongCount * 4.0;
    const taperTargetTotal = taperWeeklyKm(config, theoreticalPeakTotal, w);
    const factor = taperTargetTotal / Math.max(0.1, theoreticalPeakTotal);
    L *= factor;
    E *= factor;
  }

  let T = L + nonLongCount * E;

  // 3. Monotonicity guardrail
  if (isTaper) {
    // Taper must be non-increasing
    if (prevTotal !== null && T > prevTotal + 0.01) {
      const scale = prevTotal / T;
      L *= scale;
      E *= scale;
      T = L + nonLongCount * E;
    }
  } else if (!isCutback && prevTotal !== null && T < prevTotal - 0.01) {
    // Build weeks must be non-decreasing (at least +0.5km jump)
    const targetT = prevTotal + 0.5;
    const diff = targetT - T;
    if (nonLongCount > 0) {
      const eInc = Math.min(diff / nonLongCount, 4.0 - E);
      E += eInc;
      const remaining = targetT - (L + nonLongCount * E);
      if (remaining > 0.01) {
        L = Math.min(lrPeak, L + remaining);
      }
    } else {
      L = Math.min(lrPeak, L + diff);
    }
    // Re-apply 50% rule
    if (config.days.length === 2 && L > E + 0.01) L = E;
    T = L + nonLongCount * E;
  }

  // 3b. Novice 5K/10K: cap long-run fraction of the week; shift km to easy days (2–6 sessions/week).
  if (
    config.level === "NOVICE" &&
    (config.goal === "5k" || config.goal === "10k") &&
    nonLongCount >= 1
  ) {
    const b = rebalanceNoviceShortRaceSessionKm(L, E, T, config.days.length);
    L = b.L;
    E = b.E;
    T = b.T;
  }

  // 4. ACWR Safety Valve (Volume-based proxy)
  if (!isTaper && prevVolumes.length >= 2) {
    const prev4 = prevVolumes.slice(-4);
    const prev4Invalid = prev4.some((v) => !Number.isFinite(v) || v < 0);
    if (prev4Invalid) {
      if (process.env.NODE_ENV !== "production") {
        console.warn("[getNoviceWeeklyDistances] Skipping ACWR — invalid prior weekly volumes:", prevVolumes);
      }
    } else {
      const chronicVolume = prev4.reduce((a, b) => a + b, 0) / prev4.length;
      if (chronicVolume > 0) {
        const acwr = T / chronicVolume;
        if (acwr > 1.25) {
          const cappedT = chronicVolume * 1.25;
          const scale = cappedT / T;
          L *= scale;
          E *= scale;
          T = L + nonLongCount * E;
        }
      }
    }
  }

  // 5. Novice 5K/10K: align last build week toward duration-aware cap, then enforce ceiling + rebalance
  if (config.level === "NOVICE" && (config.goal === "5k" || config.goal === "10k") && !isTaper) {
    const weeklyCap = getNovicePeakWeeklyKm(config.goal, config.weeks);
    if (w === lastNonTaperWeek && !isCutback && T < weeklyCap - 0.15) {
      let deficit = weeklyCap - T;
      if (nonLongCount > 0) {
        const dE = Math.min(deficit / nonLongCount, NOVICE_SHORT_MAX_EASY_KM - E);
        E += dE;
        deficit = weeklyCap - (L + nonLongCount * E);
      }
      if (deficit > 0.1) {
        L = Math.min(lrPeak, L + deficit);
      }
      T = L + nonLongCount * E;
    }
    if (T > weeklyCap + 0.01) {
      const s = weeklyCap / T;
      L *= s;
      E *= s;
      T = round1(L + nonLongCount * E);
      L = round1(L);
      E = round1(E);
    }
    if (nonLongCount >= 1) {
      const b2 = rebalanceNoviceShortRaceSessionKm(L, E, T, config.days.length);
      L = b2.L;
      E = b2.E;
      T = b2.T;
    }
    if (T > weeklyCap + 0.01) {
      const s = weeklyCap / T;
      L *= s;
      E *= s;
      T = round1(L + nonLongCount * E);
      L = round1(L);
      E = round1(E);
    }
  }

  return { longKm: L, easyKm: E, totalKm: T };
}

function taperWeeklyKm(config: PlanConfig, peak: number, week: number): number {
  // Maps taper week index to % of peak.
  // HM: -30%, -50% (race). For 12w HM, the prompt describes weeks 10–11 taper + week 12 race;
  // we keep week 12 at race volume (-50%) to avoid increasing volume on race week.
  const weeks = config.weeks;
  const goal = config.goal;

  const taperStart = phaseForWeek(config, 1) === "Taper" ? 1 : (() => {
    for (let w = 1; w <= weeks; w++) {
      if (phaseForWeek(config, w) === "Taper") return w;
    }
    return weeks;
  })();

  const idx = week - taperStart; // 0-based into taper block
  if (goal === "hm" || goal === "10k" || goal === "5k") {
    if (idx === 0) return peak * 0.70;
    return peak * 0.50;
  }
  // full: -20, -35, -50
  if (idx === 0) return peak * 0.80;
  if (idx === 1) return peak * 0.65;
  return peak * 0.50;
}

function isBasePhase(phase: Phase): boolean {
  return phase === "Base" || phase === "Beginner Base" || phase === "Intermediate Base" || phase === "Advanced Base";
}

function isBuildPhase(phase: Phase): boolean {
  return (
    phase === "Race Specific" ||
    phase === "Half Marathon Build" ||
    phase === "Marathon Build" ||
    phase === "Build" ||
    phase === "Peak"
  );
}

/** Subtitle above each week card — must match actual session types. */
export function computeWeekSubtitle(
  sessionTypes: RunType[],
  phase: Phase,
  isCutback: boolean,
  weekNum: number,
): string {
  if (phase === "Taper") {
    return "Taper — preparing for race day";
  }
  let core: string;
  if (weekNum === 1) {
    core = "Introduction to structured training";
  } else if (sessionTypes.includes("interval")) {
    core = "Speed work and endurance building";
  } else if (sessionTypes.includes("tempo")) {
    core = "Threshold training and base building";
  } else {
    core = "Aerobic base building";
  }
  if (isCutback) {
    const tail = weekNum === 1 ? "introduction to structured training" : core.toLowerCase();
    return `Recovery week — ${tail}`;
  }
  return core;
}

function getLongRunKm(config: PlanConfig): { start: number; peak: number } {
  const { level, goal, weeks } = config;
  if (level === "NOVICE" && goal === "5k") {
    const peak = weeks === 8 ? 4 : weeks === 12 ? 4.5 : weeks === 16 ? 5 : weeks === 20 ? 5.5 : 5;
    return { start: 1.5, peak };
  }
  if (level === "NOVICE" && goal === "10k") {
    const peak = weeks === 8 ? 6 : weeks === 12 ? 7 : weeks === 16 ? 8 : weeks === 20 ? 9 : 8;
    return { start: 1.5, peak };
  }
  const key = `${level}-${goal}`;
  switch (key) {
    // 5K: Peak long run strictly capped at <= 8 km.
    case "BEGINNER-5k": return { start: 3, peak: 6 };
    case "INTERMEDIATE-5k": return { start: 4, peak: 7 };
    case "ADVANCED-5k": return { start: 5, peak: 8 };
    case "ELITE-5k": return { start: 6, peak: 8 };

    // 10K: Peak long run strictly capped at <= 14 km.
    case "BEGINNER-10k": return { start: 5, peak: 12 };
    case "INTERMEDIATE-10k": return { start: 6, peak: 13 };
    case "ADVANCED-10k": return { start: 8, peak: 14 };
    case "ELITE-10k": return { start: 8, peak: 14 };

    // HM & Full caps
    case "NOVICE-hm": return { start: 6, peak: 14 };
    case "NOVICE-full": return { start: 8, peak: 24 };
    case "BEGINNER-hm": return { start: 7, peak: 18 };
    case "BEGINNER-full": return { start: 10, peak: 29 };
    case "INTERMEDIATE-hm": return { start: 9, peak: 20 };
    case "INTERMEDIATE-full": return { start: 13, peak: 32 };
    case "ADVANCED-hm": return { start: 11, peak: 22 };
    case "ADVANCED-full": return { start: 16, peak: 35 };
    case "ELITE-hm": return { start: 14, peak: 28 };
    case "ELITE-full": return { start: 18, peak: 40 };
    default: return { start: 7, peak: 18 };
  }
}

function getPhaseWindows(config: Pick<PlanConfig, "weeks" | "goal">, weekNumber: number): {
  baseLengthWeeks: number;
  isBase: boolean;
  isBuild: boolean;
  isTaper: boolean;
} {
  const weeks = config.weeks;
  const goal = config.goal;

  const boundaries = (() => {
    if (weeks === 8) {
      if (goal === "5k" || goal === "10k") return { base: 3, taper: 1 };
      return { base: 2, taper: 2 };
    }
    if (weeks === 12) {
      if (goal === "5k" || goal === "10k") return { base: 3, taper: 2 };
      return { base: 4, taper: 3 };
    }
    if (weeks === 16) {
      if (goal === "5k" || goal === "10k") return { base: 4, taper: 2 };
      return { base: 6, taper: 3 };
    }
    // 20
    if (goal === "5k" || goal === "10k") return { base: 6, taper: 2 };
    return { base: 8, taper: 3 };
  })();

  const isBase = weekNumber <= boundaries.base;
  const isTaper = weekNumber > weeks - boundaries.taper;
  const isBuild = !isBase && !isTaper;

  return { baseLengthWeeks: boundaries.base, isBase, isBuild, isTaper };
}

function resolveHardType(level: PlanConfig["level"], config: PlanConfig, weekNumber: number): RunType {
  if (level === "NOVICE") {
    if (isNoviceBridgeTempoWeek(level, config.weeks, weekNumber)) {
      return "tempo";
    }
    return "easy";
  }

  const { baseLengthWeeks, isBase, isBuild } = getPhaseWindows(config, weekNumber);
  const isShorterRace = config.goal === "5k" || config.goal === "10k";

  if (level === "BEGINNER") {
    if (isBase) return weekNumber <= 3 ? "easy" : "tempo";
    if (isBuild) return "tempo";
    return "easy";
  }

  if (level === "INTERMEDIATE") {
    if (isBase) return "tempo";
    if (isBuild) {
      // For 5k/10k, start intervals earlier in build (2 weeks in).
      const intervalStartWeek = isShorterRace ? baseLengthWeeks + 2 : baseLengthWeeks + 4;
      return weekNumber >= intervalStartWeek ? "interval" : "tempo";
    }
    return "easy";
  }

  // ADVANCED / ELITE
  if (isBase) return "tempo";
  if (isBuild) {
    // For 5k/10k, nearly all build is interval/VO2 max.
    const intervalStartWeek = isShorterRace ? baseLengthWeeks + 1 : baseLengthWeeks + 2;
    return weekNumber >= intervalStartWeek ? "interval" : "tempo";
  }
  return "easy";
}

export function getDefaultLongRunDay(days: Day[]): Day {
  const uniq = daysSorted(uniqDays(days));
  if (uniq.length === 0) return "sat"; // default fallback
  let best = uniq[0];
  let bestGap = nearestTrainingDayDistance(best, new Set(uniq));
  for (const day of uniq) {
    const minGap = nearestTrainingDayDistance(day, new Set(uniq));
    if (minGap > bestGap) {
      best = day;
      bestGap = minGap;
    }
  }
  return best;
}

export function getScheduleWarnings(
  days: Day[],
  longRunDay: Day,
  level?: PlanConfig["level"],
): string[] {
  const sortedDays = daysSorted(uniqDays(days));
  if (sortedDays.length === 0 || !sortedDays.includes(longRunDay)) return [];

  const warnings: string[] = [];
  const dayAfterLongIndex = (DAY_INDEX[longRunDay] + 1) % 7;
  const dayAfterLong = (Object.keys(DAY_INDEX) as Day[]).find((day) => DAY_INDEX[day] === dayAfterLongIndex);

  if (dayAfterLong && sortedDays.includes(dayAfterLong)) {
    warnings.push(
      `⚠️ Consider leaving ${dayAfterLong} free — recovery after your long run improves adaptation.`,
    );
  }

  let hardGap = -1;
  for (const day of sortedDays) {
    if (day === longRunDay) continue;
    hardGap = Math.max(hardGap, circularDayDistance(day, longRunDay));
  }
  if (hardGap >= 0 && hardGap < 2) {
    warnings.push("⚠️ Your training days are closely spaced. Try to spread them more evenly for better recovery.");
  }

  if (sortedDays.length === 2) {
    warnings.push("ℹ️ With 2 training days, progress will be slower. 3+ days gives better results.");
  }

  if (level === "BEGINNER" && sortedDays.length >= 5) {
    warnings.push(
      "⚠️ 5-6 day plans are recommended for intermediate and advanced runners only. Consider starting with 3-4 days.",
    );
  }

  return warnings;
}

export function assignSessionsTodays(
  days: Day[],
  longRunDay: Day,
  level: PlanConfig["level"],
  config: Pick<PlanConfig, "goal" | "weeks">,
  weekNumber: number,
): Record<Day, RunType> {
  const dayList = daysSorted(uniqDays(days));
  if (!dayList.includes(longRunDay)) {
    throw new Error(`longRunDay ${longRunDay} must be included in training days`);
  }

  const out = Object.fromEntries(dayList.map((day) => [day, "easy"])) as Record<Day, RunType>;
  out[longRunDay] = "long";

  if (dayList.length === 2) {
    const other = dayList.find((d) => d !== longRunDay)!;
    const { isBase, isBuild, isTaper } = getPhaseWindows(config, weekNumber);

    if (level === "NOVICE") {
      if (weekNumber === config.weeks) {
        out[other] = "easy";
        return out;
      }
      out[other] = resolveHardType(level, {
        level,
        goal: config.goal,
        weeks: config.weeks,
        days: dayList,
        longRunDay,
        vdot: 28,
      }, weekNumber);
      return out;
    }

    if (isTaper) {
      out[other] = "easy";
      return out;
    }
    if (level === "BEGINNER") {
      out[other] = isBase ? "easy" : "tempo";
      return out;
    }
    // Keep 2-day plans conservative: never interval, always one long + one tempo in non-taper.
    out[other] = isBase || isBuild ? "tempo" : "easy";
    return out;
  }

  const afterLong = dayList.find((day) => (DAY_INDEX[longRunDay] + 1) % 7 === DAY_INDEX[day]);
  if (afterLong) out[afterLong] = "easy";

  const hardType = resolveHardType(
    level,
    { level, goal: config.goal, weeks: config.weeks, days: dayList, longRunDay, vdot: 33 },
    weekNumber,
  );
  let hardDay: Day | null = null;
  let hardGap = -1;
  for (const day of dayList) {
    if (day === longRunDay || day === afterLong) continue;
    const gap = circularDayDistance(day, longRunDay);
    if (gap > hardGap) {
      hardGap = gap;
      hardDay = day;
    }
  }
  if (hardDay) out[hardDay] = hardType;

  return out;
}

/** Session copy aligned to actual session type and phase. */
export function sessionDescriptionForPlan(type: RunType, phase: Phase, isCutback: boolean): string {
  if (isCutback) {
    if (type === "easy") return "Recovery week. Keep effort very easy.";
    if (type === "long") return "Cutback long run. Lower volume, stay relaxed.";
    if (type === "tempo") {
      return "Recovery week. Keep threshold effort controlled and sustainable.";
    }
    return "Recovery week. Keep quality work controlled — focus on form, not speed.";
  }
  if (type === "easy") {
    if (isBasePhase(phase)) {
      return "Easy aerobic run. Conversational pace throughout.";
    }
    return "Easy recovery run. Keep effort very comfortable.";
  }
  if (type === "tempo") {
    return "Sustained threshold effort. Comfortably hard pace — you should be able to speak in short sentences.";
  }
  if (type === "interval") {
    if (phase === "Taper") {
      return "Short interval sharpener. Keep volume low, maintain intensity.";
    }
    return "High intensity intervals. Include 1.5km easy warm-up, repeats at interval pace with equal rest, 1km cool-down.";
  }
  if (phase === "Taper") {
    return "Taper long run. Shorter than peak — stay fresh for race day.";
  }
  if (isBasePhase(phase)) {
    return "Base long run. Build time on feet at easy effort.";
  }
  return "Progressive long run. Finish feeling strong, not exhausted.";
}

function blockHasInterval(block: TrainingWeek[]): boolean {
  return block.some((w) => w.sessions.some((s) => s.type === "interval"));
}

/** Phase overview for the first week of a contiguous phase block. */
export function computePhaseOverviewForBlock(
  phase: Phase,
  runnerLevel: PlanConfig["level"],
  blockWeeks: TrainingWeek[],
): string {
  if (phase === "Taper") {
    return "The taper phase reduces volume to let your body recover and absorb all your training. Trust the process — feeling fresh on race day is the goal.";
  }
  if (phase === "Recovery") {
    return "This recovery week was automatically added based on your recent training load. Keep all runs easy and focus on rest and sleep.";
  }
  if (isBasePhase(phase)) {
    if (runnerLevel === "BEGINNER") {
      return "The base phase builds your aerobic engine with easy running. Every run should feel comfortable and conversational. Consistency matters more than pace at this stage.";
    }
    return "The base phase builds your aerobic engine with easy running and gradual progression. Consistency matters more than pace at this stage.";
  }
  if (isBuildPhase(phase)) {
    const hasIx = blockHasInterval(blockWeeks);
    if ((runnerLevel === "INTERMEDIATE" || runnerLevel === "ADVANCED") && hasIx) {
      return "The build phase introduces high intensity interval training alongside tempo work. The hard sessions should feel genuinely hard — the easy days must stay easy.";
    }
    return "The build phase introduces tempo running to improve your lactate threshold. Keep easy runs easy and push appropriately on tempo days.";
  }
  return "";
}

/** Fill weekSubtitle, phaseOverviewText, and per-session descriptions from plan content. */
export function finalizePlanDisplayCopy(
  plan: TrainingWeek[],
  runnerLevel: PlanConfig["level"],
): void {
  for (let i = 0; i < plan.length; i++) {
    const prev = i > 0 ? plan[i - 1] : null;
    if (i === 0 || plan[i].phase !== prev!.phase) {
      const block: TrainingWeek[] = [];
      for (let j = i; j < plan.length && plan[j].phase === plan[i].phase; j++) {
        block.push(plan[j]);
      }
      const text = computePhaseOverviewForBlock(plan[i].phase, runnerLevel, block);
      plan[i].phaseOverviewText = text || undefined;
    }
  }

  for (const week of plan) {
    const types = week.sessions.map((s) => s.type);
    if (week.phase === "Recovery" || week.isRecovery) {
      week.weekSubtitle = "Aerobic base building";
    } else {
      week.weekSubtitle = computeWeekSubtitle(types, week.phase, week.isCutback, week.week);
    }
    for (const session of week.sessions) {
      session.description = sessionDescriptionForPlan(session.type, week.phase, week.isCutback);
    }
  }
}

export function buildWeeklyVolumes(config: PlanConfig): { weeklyKm: number[]; isCutback: boolean[]; peakKm: number } {
  const peakKmBase = getPeakWeeklyKm(config.level, config.goal);
  const dayCountMult = longRunIntegrityScope(config)
    ? getSessionCountVolumeMultiplier(config.days.length)
    : DAY_COUNT_MULTIPLIER[config.days.length] ?? 1.0;
  const adjustedPeakKm = peakKmBase * dayCountMult;
  const { every, reduce, maxIncrease } = getCutbackConfig(config.level);
  const maxIncreaseEff =
    longRunIntegrityScope(config) && config.days.length === 2
      ? maxIncrease * 0.6
      : maxIncrease;

  const taperWeeks = Array.from({ length: config.weeks }, (_, i) => phaseForWeek(config, i + 1) === "Taper");
  const lastNonTaperWeek = taperWeeks.lastIndexOf(false) + 1; // 1-indexed

  const weeklyKm: number[] = [];
  const isCutbackArr: boolean[] = [];

  if (config.level === "NOVICE") {
    for (let w = 1; w <= config.weeks; w++) {
      const phase = phaseForWeek(config, w);
      const inFinalThree = w > config.weeks - 3;
      const cutback = !inFinalThree && phase !== "Taper" && w % every === 0;
      isCutbackArr.push(cutback);
      const { totalKm } = getNoviceWeeklyDistances(config, w, lastNonTaperWeek, weeklyKm);
      weeklyKm.push(round1(totalKm));
    }
    const actualPeak = round1(weeklyKm[lastNonTaperWeek - 1] ?? weeklyKm[weeklyKm.length - 1] ?? 0);
    return { weeklyKm, isCutback: isCutbackArr, peakKm: actualPeak };
  }

  const peak = round1(adjustedPeakKm);
  const startKm = getStartWeeklyKm(config.level, peak);

  let prev = startKm;
  for (let w = 1; w <= config.weeks; w++) {
    const phase = phaseForWeek(config, w);

    const inFinalThree = w > config.weeks - 3;
    const cutback = !inFinalThree && phase !== "Taper" && w % every === 0;
    isCutbackArr.push(cutback);

    if (phase === "Taper") {
      weeklyKm.push(round1(taperWeeklyKm(config, peak, w)));
      continue;
    }
    const progress = lastNonTaperWeek <= 1 ? 1 : (w - 1) / (lastNonTaperWeek - 1);
    const desired = startKm + progress * (peak - startKm);

    const maxAllowed = prev * (1 + maxIncreaseEff);
    let next = Math.min(desired, maxAllowed);

    if (w === 1) next = startKm;
    if (w === lastNonTaperWeek) next = peak;

    if (cutback) next = next * (1 - reduce);

    weeklyKm.push(round1(next));
    prev = next;
  }

  if (longRunIntegrityScope(config) && config.days.length === 2) {
    for (let i = 1; i < weeklyKm.length; i++) {
      const w = i + 1;
      if (phaseForWeek(config, w) === "Taper") continue;
      const prevW = weeklyKm[i - 1];
      weeklyKm[i] = round1(Math.min(weeklyKm[i], prevW * 1.18));
    }
  }

  return { weeklyKm, isCutback: isCutbackArr, peakKm: round1(peak) };
}

function buildLongRuns(config: PlanConfig, weeklyKm: number[], isCutback: boolean[]): number[] {
  const { start, peak } = getLongRunKm(config);

  // Peak long run should occur at the last non-taper week (before taper starts).
  const lastNonTaperWeek = (() => {
    for (let w = config.weeks; w >= 1; w--) {
      if (phaseForWeek(config, w) !== "Taper") return w;
    }
    return config.weeks;
  })();

  const longKm: number[] = [];
  let curr = start;

  for (let w = 1; w <= config.weeks; w++) {
    const phase = phaseForWeek(config, w);

    if (phase === "Taper") {
      // Reduce proportionally to weekly volume drop vs peak week volume.
      const peakWeekKm = weeklyKm[lastNonTaperWeek - 1] || weeklyKm.find((_, i) => i + 1 === lastNonTaperWeek) || 1;
      const frac = clamp((weeklyKm[w - 1] ?? 0) / Math.max(1, peakWeekKm), 0.3, 1);
      longKm.push(round1(curr * frac));
      continue;
    }

    // Grow toward peak before taper.
    if (w === 1) {
      curr = start;
    } else if (w <= lastNonTaperWeek) {
      if (config.level === "NOVICE") {
        const { longKm: lk } = getNoviceWeeklyDistances(
          config,
          w,
          lastNonTaperWeek,
          weeklyKm.slice(0, w - 1),
        );
        curr = lk;
      } else {
        const build = phase === "Race Specific";
        if (build) {
          const remainingWeeks = Math.max(1, lastNonTaperWeek - w + 1);
          const remainingDist = peak - curr;
          const ideal = remainingDist / remainingWeeks;
          const inc = clamp(Math.round(ideal), 1, 2);
          curr = Math.min(peak, curr + inc);
        } else {
          // Base phase: gentle increase (0–1 km).
          curr = Math.min(peak, curr + (curr < peak ? 1 : 0));
        }
      }
    }

    let wkLong = curr;
    if (config.level !== "NOVICE" && isCutback[w - 1]) {
      const { reduce } = getCutbackConfig(config.level);
      wkLong = wkLong * (1 - reduce);
    }
    if (longRunIntegrityScope(config) && w >= 3) {
      const minL = getMinLongRunKm(config.level, config.goal);
      wkLong = Math.max(wkLong, minL);
    }
    longKm.push(round1(wkLong));
  }

  return longKm;
}

export function generatePlan(config: PlanConfig): GeneratedPlanBundle {
  if (config.level === "NOVICE") {
    config.vdot = 28; // Safe fallback for couch-to-5k calculations
  }

  if (!Number.isFinite(config.vdot) || config.vdot <= 0) {
    config.vdot = 33;
  }

  const days = uniqDays(config.days);
  if (days.length < 2) {
    throw new Error("PlanConfig.days must include at least 2 training days");
  }

  const { weeklyKm, isCutback, peakKm } = buildWeeklyVolumes({ ...config, days });
  const longKm = buildLongRuns({ ...config, days }, weeklyKm, isCutback);

  const lastNonTaperWeek = (() => {
    for (let wi = config.weeks; wi >= 1; wi--) {
      if (phaseForWeek(config, wi) !== "Taper") return wi;
    }
    return config.weeks;
  })();
  const peakScheduledLongKm = round1(longKm[lastNonTaperWeek - 1] ?? 0);

  const paceAdjust: PlanPaceAdjust | undefined = config.paceAdjust;
  const partialAdjust = {
    easyPaceOffsetSec: paceAdjust?.easyPaceOffsetSec ?? 0,
    tempoPaceOffsetSec: paceAdjust?.tempoPaceOffsetSec ?? 0,
    intervalPaceOffsetSec: paceAdjust?.intervalPaceOffsetSec ?? 0,
    longPaceOffsetSec: paceAdjust?.longPaceOffsetSec ?? 0,
    runningExperience: paceAdjust?.runningExperience ?? null,
  };
  const pMin = getSessionPaces(config.vdot, partialAdjust);
  const intervalCaps: Record<PlanConfig["level"], number> = {
    NOVICE: 4,
    BEGINNER: 6,
    INTERMEDIATE: 8,
    ADVANCED: 10,
    ELITE: 14,
  };
  const intervalCap = intervalCaps[config.level] ?? 8;

  const plan: TrainingWeek[] = [];
  const weeklyWorkloads: number[] = [];
  const weekTotalsHistory: number[] = [];

  const noviceRunWalkTransitionWeek =
    config.level === "NOVICE" ? Math.max(1, getNoviceRunWalkTransitionWeek(config.weeks)) : 0;

  for (let w = 1; w <= config.weeks; w++) {
    const phase = phaseForWeek(config, w);
    const cutback = isCutback[w - 1] ?? false;
    const dayList = daysSorted(days);

    const longRunDay = config.longRunDay && dayList.includes(config.longRunDay)
      ? config.longRunDay
      : getDefaultLongRunDay(dayList);
    const typesForWeek = assignSessionsTodays(
      dayList,
      longRunDay,
      config.level,
      { goal: config.goal, weeks: config.weeks },
      w,
    );

    let weekKm = round1(weeklyKm[w - 1] ?? peakKm);

    const minLongKm = (config.level === "NOVICE" || config.goal === "5k") ? 1.5 : 5;
    const minSessionKm = (config.level === "NOVICE" || config.goal === "5k") ? 1.0 : 3;
    const minEasyKm = config.level === "NOVICE"
      ? 1.0
      : longRunIntegrityScope(config)
        ? getEasySessionMinimum(config.level)
        : config.level === "BEGINNER"
          ? 3
          : config.level === "INTERMEDIATE"
            ? 4
            : 5;

    const otherDays = dayList.filter((d) => typesForWeek[d] !== "long");
    const nonLongCount = otherDays.length;
    const easySessionCount = otherDays.filter((day) => typesForWeek[day] === "easy").length;

    if (longRunIntegrityScope(config) && phase !== "Taper") {
      const minEasy = getEasySessionMinimum(config.level);
      const qualitySessions = nonLongCount - easySessionCount;
      const minLongFloor = w >= 3 ? getMinLongRunKm(config.level, config.goal) : minLongKm;
      weekKm = round1(
        Math.max(weekKm, minLongFloor + minEasy * easySessionCount + minSessionKm * qualitySessions),
      );
    }

    const baseLongKm = round1(clamp(longKm[w - 1] ?? 0, minLongKm, weekKm));

    let wkLongKm: number;
    let distributedWeekKm: number;
    let nonLongCap: number;

    if (config.level === "NOVICE") {
      distributedWeekKm = weekKm;
      wkLongKm = longKm[w - 1] ?? baseLongKm;
      nonLongCap = 100;
    } else if (config.goal === "5k" || config.goal === "10k") {
      wkLongKm = baseLongKm;
      // Enforce Target Band: long run should be ~22-35% of the week.
      const minWeekKm = dayList.length >= 4 ? wkLongKm / 0.35 : wkLongKm / 0.50;
      const maxWeekKm = wkLongKm / 0.22;
      distributedWeekKm = round1(clamp(weekKm, minWeekKm, maxWeekKm));
      
      if (dayList.length === 2) {
        wkLongKm = Math.min(wkLongKm, distributedWeekKm * 0.5);
      }
      
      // Prevent non-long runs from exceeding the long run
      nonLongCap = round1(wkLongKm);
      
      const remaining = round1(Math.max(0, distributedWeekKm - wkLongKm));
      let eachOther = round1(nonLongCount > 0 ? remaining / nonLongCount : 0);
      
      if (eachOther < minSessionKm && nonLongCount > 0) {
        eachOther = minSessionKm;
        distributedWeekKm = round1(wkLongKm + (eachOther * nonLongCount));
      }
      
      if (eachOther > nonLongCap && nonLongCount > 0) {
        eachOther = nonLongCap;
        distributedWeekKm = round1(wkLongKm + (eachOther * nonLongCount));
      }
    } else {
      const constrainedWeekKm = round1(Math.min(weekKm, baseLongKm / 0.35));
      wkLongKm = round1(clamp(Math.max(baseLongKm, constrainedWeekKm * 0.35), minLongKm, constrainedWeekKm));
      distributedWeekKm = constrainedWeekKm;
      if (longRunIntegrityScope(config) && phase !== "Taper") {
        distributedWeekKm = round1(Math.max(distributedWeekKm, weekKm));
        wkLongKm = round1(
          clamp(Math.max(baseLongKm, distributedWeekKm * 0.35), minLongKm, distributedWeekKm),
        );
      }
      nonLongCap = round1(wkLongKm * 0.85);
      if (longRunIntegrityScope(config)) {
        nonLongCap = round1(Math.max(nonLongCap, getEasySessionMinimum(config.level)));
      }
    }

    // Long Run Rule: For 2-session/week programs, the Long Run must not exceed 50% of total weekly volume.
    if (dayList.length === 2 && (config.goal !== "5k" && config.goal !== "10k" || config.level === "NOVICE")) {
      if (!longRunIntegrityScope(config)) {
        wkLongKm = Math.min(wkLongKm, distributedWeekKm * 0.5);
      }
    }

    let remaining = round1(Math.max(0, distributedWeekKm - wkLongKm));
    let eachOther = round1(nonLongCount > 0 ? remaining / nonLongCount : 0);

    // Bypass generic floors and redistribution for Novice, and 5K/10K goals
    if (config.level !== "NOVICE" && config.goal !== "5k" && config.goal !== "10k") {
      const minEasyDayThreshold = longRunIntegrityScope(config) ? 2 : 4;
      if (dayList.length >= minEasyDayThreshold && easySessionCount > 0 && eachOther < minEasyKm) {
        const minRequiredWeeklyKm = round1(wkLongKm + (minEasyKm * easySessionCount));
        distributedWeekKm = round1(Math.min(peakKm, Math.max(distributedWeekKm, minRequiredWeeklyKm)));
        remaining = round1(Math.max(0, distributedWeekKm - wkLongKm));
        eachOther = round1(nonLongCount > 0 ? remaining / nonLongCount : 0);
      }

      if (eachOther > nonLongCap && !longRunIntegrityScope(config)) {
        eachOther = nonLongCap;
        distributedWeekKm = round1(wkLongKm + (eachOther * nonLongCount));
      }
    }

    const integrityThisWeek =
      longRunIntegrityScope(config) && w >= 3 && phase !== "Taper";

    let qualitySplitRef = eachOther;
    let easyKmForWeek = eachOther;

    if (integrityThisWeek) {
      const easyFloor = getEasySessionMinimum(config.level);
      const frozenRef = eachOther;
      const sumQ = sumQualityDistanceKm(
        otherDays,
        typesForWeek,
        frozenRef,
        minSessionKm,
        nonLongCap,
        intervalCap,
      );
      const qMax = maxQualityDistanceKm(
        otherDays,
        typesForWeek,
        frozenRef,
        minSessionKm,
        nonLongCap,
        intervalCap,
      );

      if (easySessionCount > 0) {
        easyKmForWeek = round1((distributedWeekKm - wkLongKm - sumQ) / easySessionCount);
      } else {
        easyKmForWeek = 0;
        distributedWeekKm = round1(wkLongKm + sumQ);
      }
      if (easySessionCount > 0 && easyKmForWeek < easyFloor) {
        distributedWeekKm = round1(wkLongKm + sumQ + easyFloor * easySessionCount);
        easyKmForWeek = easyFloor;
      }
      distributedWeekKm = round1(
        wkLongKm + sumQ + (easySessionCount > 0 ? easyKmForWeek * easySessionCount : 0),
      );

      let maxNL = Math.max(qMax, easySessionCount > 0 ? easyKmForWeek : 0);

      if (wkLongKm + 1e-9 < maxNL * 1.4) {
        const needLong = round1(maxNL * 1.4);
        const trialTotal = round1(distributedWeekKm - wkLongKm + needLong);
        if (weekAcuteToChronicOk(trialTotal, w, weekTotalsHistory, weeklyKm)) {
          wkLongKm = needLong;
          distributedWeekKm = Math.max(distributedWeekKm, trialTotal);
        } else {
          const capEasy = round1(wkLongKm / 1.4);
          if (easySessionCount > 0 && qMax <= capEasy + 1e-9) {
            easyKmForWeek = Math.max(easyFloor, Math.min(easyKmForWeek, capEasy));
            distributedWeekKm = round1(wkLongKm + sumQ + easyKmForWeek * easySessionCount);
          }
          maxNL = Math.max(qMax, easySessionCount > 0 ? easyKmForWeek : 0);
          const needLong2 = round1(maxNL * 1.4);
          const trialTotal2 = round1(distributedWeekKm - wkLongKm + needLong2);
          if (weekAcuteToChronicOk(trialTotal2, w, weekTotalsHistory, weeklyKm)) {
            wkLongKm = needLong2;
            distributedWeekKm = Math.max(distributedWeekKm, trialTotal2);
          }
        }

        easyKmForWeek =
          easySessionCount > 0
            ? round1((distributedWeekKm - wkLongKm - sumQ) / easySessionCount)
            : 0;
        if (easySessionCount > 0 && easyKmForWeek < easyFloor) {
          distributedWeekKm = round1(wkLongKm + sumQ + easyFloor * easySessionCount);
          easyKmForWeek = easyFloor;
        }
      }

      maxNL = Math.max(qMax, easySessionCount > 0 ? easyKmForWeek : 0);
      if (wkLongKm + 1e-9 < maxNL * 1.4) {
        const needLong3 = round1(maxNL * 1.4);
        const trialTotal3 = round1(distributedWeekKm - wkLongKm + needLong3);
        if (weekAcuteToChronicOk(trialTotal3, w, weekTotalsHistory, weeklyKm)) {
          wkLongKm = needLong3;
          distributedWeekKm = Math.max(distributedWeekKm, trialTotal3);
        }
        easyKmForWeek =
          easySessionCount > 0
            ? round1((distributedWeekKm - wkLongKm - sumQ) / easySessionCount)
            : 0;
        if (easySessionCount > 0 && easyKmForWeek < easyFloor) {
          distributedWeekKm = round1(wkLongKm + sumQ + easyFloor * easySessionCount);
          easyKmForWeek = easyFloor;
        }
      }

      for (let guard = 0; guard < 100; guard++) {
        const mnl = Math.max(qMax, easySessionCount > 0 ? easyKmForWeek : 0);
        if (mnl < 1e-6 || wkLongKm + 1e-9 >= mnl * 1.4) break;
        wkLongKm = round1(wkLongKm + 0.1);
        if (peakScheduledLongKm > 0) {
          const needB = round1(mnl * 1.4);
          wkLongKm = Math.min(wkLongKm, Math.max(peakScheduledLongKm, needB));
        }
      }

      distributedWeekKm = round1(
        wkLongKm + sumQ + (easySessionCount > 0 ? easyKmForWeek * easySessionCount : 0),
      );

      if (peakScheduledLongKm > 0) {
        const mnlCap = Math.max(qMax, easySessionCount > 0 ? easyKmForWeek : 0);
        const needL = round1(mnlCap * 1.4);
        const capLong = Math.max(peakScheduledLongKm, needL);
        wkLongKm = Math.min(wkLongKm, capLong);
        wkLongKm = Math.max(wkLongKm, needL);
        distributedWeekKm = round1(
          wkLongKm + sumQ + (easySessionCount > 0 ? easyKmForWeek * easySessionCount : 0),
        );
        const mnl2 = Math.max(qMax, easySessionCount > 0 ? easyKmForWeek : 0);
        if (mnl2 > 1e-6 && wkLongKm + 1e-9 < mnl2 * 1.4 && easySessionCount > 0) {
          const maxEasy2 = round1(wkLongKm / 1.4);
          easyKmForWeek = Math.max(easyFloor, Math.min(easyKmForWeek, maxEasy2));
          distributedWeekKm = round1(wkLongKm + sumQ + easyKmForWeek * easySessionCount);
        }
      }

      for (let z = 0; z < 50; z++) {
        const totalPre = round1(
          wkLongKm + sumQ + (easySessionCount > 0 ? easyKmForWeek * easySessionCount : 0),
        );
        if (weekAcuteToChronicOk(totalPre, w, weekTotalsHistory, weeklyKm)) break;
        if (easySessionCount === 0 || easyKmForWeek <= easyFloor + 1e-9) break;
        easyKmForWeek = round1(Math.max(easyFloor, easyKmForWeek - 0.2));
        distributedWeekKm = round1(wkLongKm + sumQ + easyKmForWeek * easySessionCount);
      }

      qualitySplitRef = frozenRef;
    }

    // Enforce a minimum 48-hour gap between sessions for all plans with 3 or fewer days per week.
    if (dayList.length <= 3) {
      const sorted = daysSorted(dayList);
      for (let i = 0; i < sorted.length; i++) {
        const curr = sorted[i];
        const next = sorted[(i + 1) % sorted.length];
        const dist = circularDayDistance(curr, next);
        if (dist < 2) {
          // Warning/validation only
        }
      }
    }

    let currentWeekWorkload = 0;

    const sessions: Session[] = dayList.map((day) => {
      const type = typesForWeek[day];
      let km: number;
      if (config.level === "NOVICE") {
        km = type === "long" ? wkLongKm : eachOther;
      } else if (integrityThisWeek) {
        km =
          type === "long"
            ? wkLongKm
            : type === "easy"
              ? round1(easyKmForWeek)
              : getQualitySessionKm(
                  type as "tempo" | "interval",
                  qualitySplitRef,
                  minSessionKm,
                  nonLongCap,
                  intervalCap,
                );
      } else {
        km = type === "long" ? wkLongKm : 
             type === "interval" ? round1(clamp(eachOther, minSessionKm, Math.min(intervalCap, nonLongCap))) : 
             round1(clamp(eachOther, minSessionKm, Math.max(minSessionKm, nonLongCap)));
      }

      const paceObj =
        config.level === "NOVICE" && type === "tempo"
          ? pMin.easy
          : type === "long"
            ? pMin.long
            : type === "easy"
              ? pMin.easy
              : type === "tempo"
                ? pMin.tempo
                : pMin.interval;
      const targetPaceMinPerKm = round1(paceObj.asSecondsPerKm / 60);

      const targetRpe =
        config.level === "NOVICE"
          ? type === "long"
            ? 4
            : type === "tempo"
              ? 5
              : 3
          : type === "long"
            ? 5
            : type === "easy"
              ? 4
              : type === "tempo"
                ? 7
                : 9;
      const plannedWorkload = round1(km * targetPaceMinPerKm * targetRpe);
      currentWeekWorkload += plannedWorkload;

      const session: Session = {
        id: `${w}-${day}`,
        day,
        type,
        targetDistanceKm: round1(km),
        targetPaceMinPerKm,
        targetPaceFormatted: paceObj.formattedMinPerKm,
        description: "",
        targetRpe,
        plannedWorkload,
      };

      if (config.level === "NOVICE") {
        session.structure = {
          warmupMin: 5,
          cooldownMin: 5,
        };
        if (type !== "tempo" && noviceRunWalkTransitionWeek > 0 && w <= noviceRunWalkTransitionWeek) {
          const tw = noviceRunWalkTransitionWeek;
          const density =
            tw <= 1 ? 0.4 : w >= tw ? 1 : 0.4 + ((w - 1) / (tw - 1)) * 0.6;
          const runSec = 60;
          const walkSec = Math.round(runSec * (1 / density - 1));
          session.structure.runWalkRatio = { runSec, walkSec };
        }
      }

      return session;
    });

    weeklyWorkloads.push(currentWeekWorkload);

    plan.push({
      week: w,
      phase,
      isCutback: cutback,
      sessions,
    });

    weekTotalsHistory.push(
      round1(sessions.reduce((sum, s) => sum + s.targetDistanceKm, 0)),
    );
  }

  const validDays = new Set(days);
  for (const week of plan) {
    for (const session of week.sessions) {
      if (!validDays.has(session.day)) {
        throw new Error(`generatePlan produced session for day ${session.day} which is not in config.days ${days.join(",")}`);
      }
    }
  }

  finalizePlanDisplayCopy(plan, config.level);

  if (config.level === "NOVICE") {
    const tempoStart = getNoviceTempoWindowStart(config.weeks);
    for (const week of plan) {
      week.noviceGraduationEligible = true;
      week.noviceTempoWindowStart = tempoStart;
      for (const session of week.sessions) {
        if (session.type === "tempo") {
          session.description =
            "Bridge run — a controlled introduction to a slightly higher effort before your next training block.";
        }
      }
    }
  }

  return {
    weeks: plan,
    noviceRuntime: config.level === "NOVICE" ? defaultNoviceRuntimeState() : undefined,
  };
}

export function validateAssignments(): void {
  const assertAssignment = (
    name: string,
    actual: Record<Day, RunType>,
    expected: Array<[Day, RunType]>,
  ) => {
    for (const [day, type] of expected) {
      if (actual[day] !== type) {
        throw new Error(`${name} failed: expected ${day}=${type}, got ${day}=${actual[day] ?? "undefined"}`);
      }
    }
  };

  assertAssignment(
    "SCENARIO 1",
    assignSessionsTodays(["mon", "thu"], "thu", "BEGINNER", { goal: "hm", weeks: 12 }, 2),
    [["mon", "easy"], ["thu", "long"]],
  );

  assertAssignment(
    "NOVICE 2-DAY W1 5K/12W",
    assignSessionsTodays(["mon", "thu"], "thu", "NOVICE", { goal: "5k", weeks: 12 }, 1),
    [["mon", "easy"], ["thu", "long"]],
  );
  assertAssignment(
    "NOVICE 2-DAY W10 BRIDGE 5K/12W",
    assignSessionsTodays(["mon", "thu"], "thu", "NOVICE", { goal: "5k", weeks: 12 }, 10),
    [["mon", "tempo"], ["thu", "long"]],
  );
  assertAssignment(
    "NOVICE 2-DAY W11 BRIDGE 5K/12W",
    assignSessionsTodays(["mon", "thu"], "thu", "NOVICE", { goal: "5k", weeks: 12 }, 11),
    [["mon", "tempo"], ["thu", "long"]],
  );
  assertAssignment(
    "NOVICE 2-DAY W12 TAPER 5K/12W",
    assignSessionsTodays(["mon", "thu"], "thu", "NOVICE", { goal: "5k", weeks: 12 }, 12),
    [["mon", "easy"], ["thu", "long"]],
  );

  assertAssignment(
    "SCENARIO 2",
    assignSessionsTodays(["tue", "sat"], "sat", "INTERMEDIATE", { goal: "hm", weeks: 16 }, 10),
    [["tue", "tempo"], ["sat", "long"]],
  );

  assertAssignment(
    "SCENARIO 2B",
    assignSessionsTodays(["tue", "sat"], "sat", "BEGINNER", { goal: "hm", weeks: 16 }, 10),
    [["tue", "tempo"], ["sat", "long"]],
  );

  assertAssignment(
    "SCENARIO 2C",
    assignSessionsTodays(["tue", "sat"], "sat", "ADVANCED", { goal: "hm", weeks: 16 }, 10),
    [["tue", "tempo"], ["sat", "long"]],
  );

  assertAssignment(
    "SCENARIO 3",
    assignSessionsTodays(["mon", "wed", "fri", "sun"], "sun", "INTERMEDIATE", { goal: "hm", weeks: 16 }, 10),
    [["mon", "easy"], ["wed", "interval"], ["fri", "easy"], ["sun", "long"]],
  );

  assertAssignment(
    "SCENARIO 4",
    assignSessionsTodays(["mon", "tue", "wed", "fri", "sun"], "sun", "ADVANCED", { goal: "hm", weeks: 16 }, 8),
    [["mon", "easy"], ["tue", "easy"], ["wed", "interval"], ["fri", "easy"], ["sun", "long"]],
  );

  assertAssignment(
    "SCENARIO 5",
    assignSessionsTodays(["mon", "tue", "wed", "thu", "fri", "sat"], "sat", "ADVANCED", { goal: "hm", weeks: 16 }, 10),
    [["mon", "easy"], ["tue", "interval"], ["wed", "easy"], ["thu", "easy"], ["fri", "easy"], ["sat", "long"]],
  );
}

if (process.env.VALIDATE_ASSIGNMENTS === "true") {
  validateAssignments();
}

