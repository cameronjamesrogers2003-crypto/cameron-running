import type { Day, Phase, RunType, Session, TrainingWeek } from "@/data/trainingPlan";
import { getDefaultLongRunDay } from "@/lib/generatePlan";
import {
  buildSessionDescription,
  estimateSessionDurationMin,
  type PlanPhase,
} from "@/lib/sessionBuilderV2";
import { formatPaceMinPerKm, getPacesForVdot, secondsPerKmToMinPerKm } from "@/lib/vdotTables";

export type { PlanPhase } from "@/lib/sessionBuilderV2";

export interface PlanConfigV2 {
  goalDistance: "5K" | "10K" | "HalfMarathon" | "Marathon";
  experienceLevel: "NOVICE" | "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
  vdot: number;
  totalWeeks: 8 | 12 | 16 | 20;
  sessionsPerWeek: 2 | 3 | 4 | 5 | 6;
  startDate: Date;
  trainingDays: Day[];
  /** When set, the long run is always scheduled on this day (overrides day order in trainingDays). */
  longRunDay?: Day;
}

const SESSION_SCALE: Record<2 | 3 | 4 | 5 | 6, number> = {
  2: 0.74,
  3: 1.0,
  4: 1.24,
  5: 1.46,
  6: 1.67,
};

/** Mon-first calendar order for sorting sessions within a week. */
const DAY_CAL_ORDER: Record<Day, number> = {
  mon: 0,
  tue: 1,
  wed: 2,
  thu: 3,
  fri: 4,
  sat: 5,
  sun: 6,
};

const PEAK_KM: Record<
  PlanConfigV2["goalDistance"],
  Record<PlanConfigV2["experienceLevel"], number>
> = {
  "5K": { NOVICE: 15, BEGINNER: 25, INTERMEDIATE: 45, ADVANCED: 65 },
  "10K": { NOVICE: 20, BEGINNER: 35, INTERMEDIATE: 55, ADVANCED: 80 },
  HalfMarathon: { NOVICE: 35, BEGINNER: 50, INTERMEDIATE: 70, ADVANCED: 95 },
  Marathon: { NOVICE: 45, BEGINNER: 65, INTERMEDIATE: 90, ADVANCED: 130 },
};

const MAX_WEEK_INCREASE: Record<PlanConfigV2["experienceLevel"], number> = {
  NOVICE: 0.05,
  BEGINNER: 0.1,
  INTERMEDIATE: 0.12,
  ADVANCED: 0.15,
};

function cutbackRule(level: PlanConfigV2["experienceLevel"]): { every: number; cutPct: number } {
  switch (level) {
    case "NOVICE":
      return { every: 3, cutPct: 0.25 };
    case "BEGINNER":
      return { every: 4, cutPct: 0.2 };
    case "INTERMEDIATE":
      return { every: 4, cutPct: 0.15 };
    case "ADVANCED":
      return { every: 5, cutPct: 0.1 };
    default:
      return { every: 4, cutPct: 0.15 };
  }
}

/** Priority order (first = primary quality / long). */
export const SESSION_PRIORITY_ORDER: Record<2 | 3 | 4 | 5 | 6, RunType[]> = {
  2: ["long", "easy"],
  3: ["long", "tempo", "easy"],
  4: ["long", "tempo", "easy", "easy"],
  5: ["long", "tempo", "interval", "easy", "easy"],
  6: ["long", "tempo", "interval", "easy", "easy", "easy"],
};

function phaseOrderIndex(p: PlanPhase): number {
  switch (p) {
    case "Base":
      return 0;
    case "Build":
      return 1;
    case "Peak":
      return 2;
    case "Taper":
      return 3;
    default:
      return 0;
  }
}

/** Minimum phase index (0=Base) where session type is first allowed. */
function minPhaseIndexForType(
  level: PlanConfigV2["experienceLevel"],
  t: RunType,
): number {
  if (t === "easy" || t === "long") return 0;
  if (t === "tempo") {
    if (level === "NOVICE") return 1;
    return 0;
  }
  if (t === "interval") {
    if (level === "NOVICE") return 999;
    if (level === "BEGINNER") return 2;
    if (level === "INTERMEDIATE") return 1;
    return 0;
  }
  return 0;
}

function typeAllowedInPhase(
  level: PlanConfigV2["experienceLevel"],
  phase: PlanPhase,
  t: RunType,
): boolean {
  if (phase === "Taper") return true;
  return phaseOrderIndex(phase) >= minPhaseIndexForType(level, t);
}

function filterTypesForWeek(
  raw: RunType[],
  level: PlanConfigV2["experienceLevel"],
  phase: PlanPhase,
): RunType[] {
  return raw.map((t) => {
    if (!typeAllowedInPhase(level, phase, t)) {
      if (t === "tempo" || t === "interval") return "easy";
      return t;
    }
    return t;
  });
}

function fixConsecutiveLongOrDoubleInterval(types: RunType[]): RunType[] {
  const out = [...types];
  for (let i = 0; i < out.length; i++) {
    if (out[i] === "long" && out[i + 1] === "long") {
      out[i + 1] = "easy";
    }
    if (out[i] === "interval" && out[i + 1] === "interval") {
      out[i + 1] = "easy";
    }
  }
  return out;
}

/**
 * Ordered RunTypes for the week after intro filtering and scheduling rules.
 * Reps (5K) and cruise tempo (10K) use `interval` / `tempo` types — flags set when building Session rows.
 */
export function assignSessionTypes(
  phase: PlanPhase,
  level: PlanConfigV2["experienceLevel"],
  sessionsPerWeek: 2 | 3 | 4 | 5 | 6,
  _goalDistance: PlanConfigV2["goalDistance"],
): RunType[] {
  const raw = SESSION_PRIORITY_ORDER[sessionsPerWeek];
  let types = filterTypesForWeek(raw, level, phase);
  types = fixConsecutiveLongOrDoubleInterval(types);
  void _goalDistance;
  return types;
}

export function getPhaseWeeks(
  goalDistance: PlanConfigV2["goalDistance"],
  experienceLevel: PlanConfigV2["experienceLevel"],
  totalWeeks: number,
): Array<{ phase: PlanPhase; weeks: number }> {
  if (goalDistance === "Marathon" && totalWeeks < 8) {
    throw new Error("FM plan requires minimum 8 weeks.");
  }

  const short = goalDistance === "5K" || goalDistance === "10K";
  const hm = goalDistance === "HalfMarathon" || goalDistance === "Marathon";
  const nb = experienceLevel === "NOVICE" || experienceLevel === "BEGINNER";

  const taperWks = short ? 1 : 2;
  const rest = totalWeeks - taperWks;

  let pBase = 0.6;
  let pBuild = 0.2;
  let pPeak = 0.1;
  if (short && !nb) {
    pBase = 0.4;
    pBuild = 0.4;
    pPeak = 0.1;
  }
  if (hm && nb) {
    pBase = 0.5;
    pBuild = 0.3;
    pPeak = 0.1;
  }
  if (hm && !nb) {
    pBase = 0.3;
    pBuild = 0.4;
    pPeak = 0.2;
  }

  let baseW = Math.floor(rest * pBase);
  const buildW = Math.floor(rest * pBuild);
  const peakW = Math.floor(rest * pPeak);
  const assigned = baseW + buildW + peakW;
  const remainder = rest - assigned;
  baseW += remainder;

  return [
    { phase: "Base", weeks: baseW },
    { phase: "Build", weeks: buildW },
    { phase: "Peak", weeks: peakW },
    { phase: "Taper", weeks: taperWks },
  ];
}

/** Expand phase segments to one PlanPhase per calendar week (1-based week index handled by caller). */
export function flattenPhaseWeeks(
  segments: Array<{ phase: PlanPhase; weeks: number }>,
): PlanPhase[] {
  const out: PlanPhase[] = [];
  for (const seg of segments) {
    for (let i = 0; i < seg.weeks; i++) {
      out.push(seg.phase);
    }
  }
  return out;
}

export function checkAcwr(
  currentWeekKm: number,
  previousWeeks: number[],
): { acwr: number; safe: boolean; cappedCurrentWeekKm: number } {
  const slice = previousWeeks.slice(-4);
  const n = slice.length;
  const avg = n > 0 ? slice.reduce((a, b) => a + b, 0) / n : Math.max(1, currentWeekKm);
  const denom = Math.max(avg, 1e-9);
  let capped = currentWeekKm;
  let acwr = capped / denom;
  let safe = acwr <= 1.5;
  if (!safe) {
    capped = 1.49 * denom;
    acwr = capped / denom;
    safe = acwr <= 1.5;
  }
  return { acwr, safe, cappedCurrentWeekKm: capped };
}

export function buildVolumeProgression(
  totalWeeks: number,
  peakVolumeKm: number,
  level: PlanConfigV2["experienceLevel"],
  phaseWeeks: Array<{ phase: PlanPhase; weeks: number }>,
): number[] {
  const phases = flattenPhaseWeeks(phaseWeeks);
  const maxInc = MAX_WEEK_INCREASE[level];
  const { every: cutEvery, cutPct } = cutbackRule(level);

  const { weeks: taperCount } = phaseWeeks.find((s) => s.phase === "Taper") ?? { weeks: 1 };
  const taperStart = totalWeeks - taperCount;

  let peakEndIdx = taperStart - 1;
  for (let i = 0; i < taperStart; i++) {
    if (phases[i] === "Peak") peakEndIdx = i;
  }
  if (peakEndIdx < 0) peakEndIdx = 0;

  const vol: number[] = new Array(totalWeeks).fill(0);

  vol[peakEndIdx] = peakVolumeKm;
  for (let w = peakEndIdx - 1; w >= 0; w--) {
    vol[w] = vol[w + 1]! / (1 + maxInc);
  }
  const peakRef = vol[Math.max(0, taperStart - 1)] ?? peakVolumeKm;

  for (let w = taperStart; w < totalWeeks; w++) {
    const ti = w - taperStart;
    if (taperCount === 1) {
      vol[w] = peakRef * 0.45;
    } else if (taperCount >= 2) {
      if (ti === 0) vol[w] = peakRef * 0.8;
      else vol[w] = peakRef * 0.45;
    }
  }

  for (let w = 0; w < totalWeeks; w++) {
    if (phases[w] === "Taper") continue;
    const weekNum = w + 1;
    if (cutEvery > 0 && weekNum % cutEvery === 0) {
      vol[w]! *= 1 - cutPct;
    }
  }

  for (let w = 0; w < totalWeeks; w++) {
    if (phases[w] === "Taper") continue;
    const prev = vol.slice(0, w);
    const { cappedCurrentWeekKm } = checkAcwr(vol[w]!, prev);
    vol[w] = cappedCurrentWeekKm;
  }

  return vol;
}

function toStoredPhase(p: PlanPhase): Phase {
  return p;
}

function paceMinPerKmForType(
  paces: ReturnType<typeof getPacesForVdot>,
  t: RunType,
  opts: { isReps?: boolean; isRacePace?: boolean; goalDistance: PlanConfigV2["goalDistance"] },
): number {
  if (opts.isRacePace) {
    if (opts.goalDistance === "5K" || opts.goalDistance === "10K") {
      return secondsPerKmToMinPerKm(paces.threshold);
    }
    return secondsPerKmToMinPerKm(paces.marathon);
  }
  if (t === "easy" || t === "long") return secondsPerKmToMinPerKm(paces.easy);
  if (t === "tempo") return secondsPerKmToMinPerKm(paces.threshold);
  if (t === "interval" && opts.isReps) return secondsPerKmToMinPerKm(paces.repetition);
  return secondsPerKmToMinPerKm(paces.interval);
}

function paceSecondsForType(
  paces: ReturnType<typeof getPacesForVdot>,
  t: RunType,
  opts: { isReps?: boolean; isRacePace?: boolean; goalDistance: PlanConfigV2["goalDistance"] },
): number {
  if (opts.isRacePace) {
    if (opts.goalDistance === "5K" || opts.goalDistance === "10K") return paces.threshold;
    return paces.marathon;
  }
  if (t === "easy" || t === "long") return paces.easy;
  if (t === "tempo") return paces.threshold;
  if (t === "interval" && opts.isReps) return paces.repetition;
  return paces.interval;
}

/** Distance weights per session index for a given count (sum to 1). */
function distanceWeights(n: number, types: RunType[]): number[] {
  const w = types.map(() => 1 / n);
  for (let i = 0; i < types.length; i++) {
    if (types[i] === "long") w[i] = 0.42;
    else if (types[i] === "tempo") w[i] = 0.22;
    else if (types[i] === "interval") w[i] = 0.18;
    else w[i] = 0.12;
  }
  const s = w.reduce((a, b) => a + b, 0);
  return w.map((x) => x / s);
}

const MIN_EASY_KM = 5;
const LONG_MAX_WEEKLY_FRACTION = 0.3;
/** Only apply the long-as-fraction-of-week cap when weekly volume is at least this (km). */
const LONG_FRACTION_WEEK_MIN_KM = 40;
/** Long run must be at least this many km. */
const MIN_LONG_RUN_KM = 8;
/** Minimum km to leave on tempo/interval when stealing volume for easy-floor fixes. */
const MIN_QUALITY_KM = 1.5;

function absoluteLongRunCapKm(
  goalDistance: PlanConfigV2["goalDistance"],
  level: PlanConfigV2["experienceLevel"],
): number {
  if (goalDistance === "5K") return 15;
  if (goalDistance === "10K") return 22;
  if (goalDistance === "HalfMarathon") return 26;
  if (level === "NOVICE" || level === "BEGINNER") return 32;
  return 38;
}

function sumDists(dists: number[]): number {
  return dists.reduce((a, b) => a + b, 0);
}

function redistributeKmToSessionIndices(dists: number[], indices: number[], km: number): void {
  if (km <= 1e-9 || indices.length === 0) return;
  const each = km / indices.length;
  for (const i of indices) {
    dists[i] = round1(dists[i] + each);
  }
  const drift = km - indices.length * each;
  if (Math.abs(drift) > 1e-6) {
    dists[indices[0]!] = round1(dists[indices[0]!] + drift);
  }
}

function redistributeFreedKmToNonLong(dists: number[], types: RunType[], freedKm: number, longIdx: number): void {
  if (freedKm <= 1e-9) return;
  const recipients: number[] = [];
  for (let i = 0; i < types.length; i++) {
    if (longIdx >= 0 && i === longIdx) continue;
    recipients.push(i);
  }
  if (recipients.length === 0) return;
  redistributeKmToSessionIndices(dists, recipients, freedKm);
}

function longestEasyDistanceKm(dists: number[], types: RunType[]): number {
  let m = 0;
  for (let i = 0; i < types.length; i++) {
    if (types[i] === "easy") m = Math.max(m, dists[i]);
  }
  return m;
}

/** Pull volume from easy (then quality) for a long-run increase; respects MIN_EASY_KM / MIN_QUALITY_KM. Returns km removed from other sessions. */
function takeKmForLongBoostFromEasiesThenQuality(dists: number[], types: RunType[], needKm: number): number {
  const startRem = needKm;
  let rem = needKm;
  for (let guard = 0; guard < 40 && rem > 1e-6; guard++) {
    const easyPool = easyIndices(types).filter((i) => dists[i] > MIN_EASY_KM + 1e-6);
    if (easyPool.length > 0) {
      const sum = easyPool.reduce((s, i) => s + dists[i], 0);
      if (sum <= 1e-9) break;
      let took = 0;
      for (const i of easyPool) {
        const grab = Math.min(rem * (dists[i] / sum), dists[i] - MIN_EASY_KM);
        if (grab <= 1e-9) continue;
        dists[i] = round1(dists[i] - grab);
        took += grab;
      }
      rem -= took;
      if (took < 1e-6) break;
      continue;
    }
    const qPool = qualitySessionIndices(types).filter((i) => dists[i] > MIN_QUALITY_KM + 1e-6);
    if (qPool.length === 0) break;
    const sumQ = qPool.reduce((s, i) => s + dists[i], 0);
    if (sumQ <= 1e-9) break;
    let tookQ = 0;
    for (const i of qPool) {
      const grab = Math.min(rem * (dists[i] / sumQ), dists[i] - MIN_QUALITY_KM);
      if (grab <= 1e-9) continue;
      dists[i] = round1(dists[i] - grab);
      tookQ += grab;
    }
    rem -= tookQ;
    if (tookQ < 1e-6) break;
  }
  return startRem - rem;
}

/**
 * When the long floor cannot fit under the absolute ceiling, scale easy distances down
 * so the longest easy stays within (absoluteCap - 2) km; freed volume goes to quality / non-easy.
 */
function shrinkEasySessionsProportionallyForLongAbsoluteCeiling(
  dists: number[],
  types: RunType[],
  capAbs: number,
): void {
  const maxEasyKm = capAbs - 2;
  if (maxEasyKm <= MIN_EASY_KM + 1e-6) return;

  for (let guard = 0; guard < 8; guard++) {
    const longestE = longestEasyDistanceKm(dists, types);
    if (longestE <= maxEasyKm + 1e-6) break;
    const s = maxEasyKm / longestE;
    const eIdx = easyIndices(types);
    if (eIdx.length === 0) break;
    let freed = 0;
    for (const i of eIdx) {
      const old = dists[i];
      const next = round1(old * s);
      const clamped = Math.max(MIN_EASY_KM, next);
      freed += old - clamped;
      dists[i] = clamped;
    }
    if (freed > 1e-6) absorbKmIntoQualityElseNonEasy(dists, types, freed);
  }
}

/** Shed km from quality sessions proportionally (for negative drift after long/easy adjustments). */
function shedKmFromQualityProportional(dists: number[], types: RunType[], shedKm: number): void {
  let rem = shedKm;
  for (let guard = 0; guard < 24 && rem > 1e-6; guard++) {
    const pool = qualitySessionIndices(types).filter((i) => dists[i] > MIN_QUALITY_KM + 1e-6);
    if (pool.length === 0) break;
    const sum = pool.reduce((s, i) => s + dists[i], 0);
    if (sum <= 1e-9) break;
    let took = 0;
    for (const i of pool) {
      const grab = Math.min(rem * (dists[i] / sum), dists[i] - MIN_QUALITY_KM);
      if (grab <= 1e-9) continue;
      dists[i] = round1(dists[i] - grab);
      took += grab;
    }
    rem -= took;
    if (took < 1e-6) break;
  }
}

/**
 * Long run: optional cap at 30% of weekly total (only when weekTotalKm >= LONG_FRACTION_WEEK_MIN_KM),
 * then absolute goal/level ceiling. Freed km is reallocated to non-long sessions.
 * Then enforce a minimum long distance: max(longest easy + 2 km, 8 km), without exceeding the absolute cap;
 * if that floor would exceed the cap, hold long at the cap and shrink easy runs proportionally, then
 * nudge the week total back toward weekTotalKm.
 */
function applyLongRunDistanceGuards(
  dists: number[],
  types: RunType[],
  weekTotalKm: number,
  goalDistance: PlanConfigV2["goalDistance"],
  experienceLevel: PlanConfigV2["experienceLevel"],
): void {
  const li = types.indexOf("long");
  if (li < 0 || weekTotalKm <= 0) return;

  const capAbs = absoluteLongRunCapKm(goalDistance, experienceLevel);
  const cap30 =
    weekTotalKm >= LONG_FRACTION_WEEK_MIN_KM ? weekTotalKm * LONG_MAX_WEEKLY_FRACTION : Number.POSITIVE_INFINITY;

  const prevLong = dists[li];
  const cappedDist = Math.min(prevLong, cap30, capAbs);
  const freed = prevLong - cappedDist;
  dists[li] = round1(Math.max(cappedDist, 0.1));
  redistributeFreedKmToNonLong(dists, types, freed, li);

  const longestE = longestEasyDistanceKm(dists, types);
  const floorLong = Math.max(longestE + 2, MIN_LONG_RUN_KM);
  const afterCapLong = dists[li];
  const rawDesired = Math.max(afterCapLong, floorLong);

  if (rawDesired <= capAbs + 1e-9) {
    const boost = rawDesired - dists[li];
    if (boost > 1e-6) {
      const taken = takeKmForLongBoostFromEasiesThenQuality(dists, types, boost);
      dists[li] = round1(dists[li] + taken);
    }
  } else {
    const boostToCap = capAbs - dists[li];
    let takenCap = 0;
    if (boostToCap > 1e-6) {
      takenCap = takeKmForLongBoostFromEasiesThenQuality(dists, types, boostToCap);
    }
    dists[li] = round1(Math.min(capAbs, dists[li] + takenCap));
    shrinkEasySessionsProportionallyForLongAbsoluteCeiling(dists, types, capAbs);

    let drift = round1(weekTotalKm - sumDists(dists));
    if (drift > 0.05) {
      absorbKmIntoQualityElseNonEasy(dists, types, drift);
    } else if (drift < -0.05) {
      shedKmFromQualityProportional(dists, types, -drift);
    }
  }

  if (dists[li] > capAbs + 1e-6) {
    const over = dists[li] - capAbs;
    dists[li] = round1(capAbs);
    redistributeFreedKmToNonLong(dists, types, over, li);
  }
}

function stealKmFromQualityForEasyFloor(
  dists: number[],
  types: RunType[],
  needKm: number,
): number {
  let taken = 0;
  let remaining = needKm;
  const order = types.map((t, i) => ({ t, i })).filter((x) => x.t === "tempo" || x.t === "interval");
  for (const { i } of order) {
    if (remaining <= 1e-9) break;
    const avail = dists[i] - MIN_QUALITY_KM;
    if (avail <= 0) continue;
    const grab = Math.min(remaining, avail);
    dists[i] = round1(dists[i] - grab);
    taken += grab;
    remaining -= grab;
  }
  return taken;
}

function easyIndices(types: RunType[]): number[] {
  return types.map((t, i) => (t === "easy" ? i : -1)).filter((i) => i >= 0);
}

function qualitySessionIndices(types: RunType[]): number[] {
  return types.map((t, i) => (t === "tempo" || t === "interval" ? i : -1)).filter((i) => i >= 0);
}

function absorbKmIntoQualityElseNonEasy(dists: number[], types: RunType[], km: number): void {
  if (km <= 1e-9) return;
  const q = qualitySessionIndices(types);
  if (q.length > 0) {
    redistributeKmToSessionIndices(dists, q, km);
    return;
  }
  const nonEasy: number[] = [];
  for (let i = 0; i < types.length; i++) {
    if (types[i] !== "easy") nonEasy.push(i);
  }
  if (nonEasy.length > 0) {
    redistributeKmToSessionIndices(dists, nonEasy, km);
  }
}

/**
 * Easy runs >= MIN_EASY_KM. Merge or remove easy sessions rather than emitting sub-5 km easies.
 */
function consolidateEasyRunDistances(dists: number[], types: RunType[], days: Day[]): void {
  let guard = 0;
  while (guard++ < 48) {
    const eIdx = easyIndices(types);
    if (eIdx.length === 0) break;
    const below = eIdx.filter((i) => dists[i] < MIN_EASY_KM);
    if (below.length === 0) break;

    if (eIdx.length >= 2) {
      let bestA = eIdx[0]!;
      let bestB = eIdx[1]!;
      let bestSum = dists[bestA] + dists[bestB];
      for (let k = 0; k < eIdx.length; k++) {
        for (let m = k + 1; m < eIdx.length; m++) {
          const i = eIdx[k]!;
          const j = eIdx[m]!;
          const s = dists[i] + dists[j];
          if (s < bestSum) {
            bestSum = s;
            bestA = i;
            bestB = j;
          }
        }
      }
      const lo = Math.min(bestA, bestB);
      const hi = Math.max(bestA, bestB);
      dists[lo] = round1(dists[lo] + dists[hi]);
      dists.splice(hi, 1);
      types.splice(hi, 1);
      days.splice(hi, 1);
      continue;
    }

    const only = easyIndices(types)[0]!;
    const deficit = MIN_EASY_KM - dists[only];
    if (deficit <= 1e-9) break;

    const stolen = stealKmFromQualityForEasyFloor(dists, types, deficit);
    dists[only] = round1(dists[only] + stolen);

    if (dists[only] >= MIN_EASY_KM - 1e-6) break;

    const freed = dists[only] ?? 0;
    dists.splice(only, 1);
    types.splice(only, 1);
    days.splice(only, 1);
    absorbKmIntoQualityElseNonEasy(dists, types, freed);
    continue;
  }
}

/** Rounding / merges can leave sum slightly under the weekly target; add remainder to quality work. */
function absorbPositiveWeeklyDrift(dists: number[], types: RunType[], weekTotalKm: number): void {
  const drift = round1(weekTotalKm - sumDists(dists));
  if (drift < 0.05) return;
  const q = qualitySessionIndices(types);
  if (q.length > 0) {
    redistributeKmToSessionIndices(dists, q, drift);
    return;
  }
  const eIdx = easyIndices(types);
  if (eIdx.length > 0) {
    redistributeKmToSessionIndices(dists, eIdx, drift);
    return;
  }
  const li = types.indexOf("long");
  if (li >= 0) {
    dists[li] = round1(dists[li] + drift);
  }
}

/** Minimum km for tempo or interval (including rep-style intervals) in weekly volume floor. */
const MIN_TEMPO_INTERVAL_WEEK_KM = 4;

/**
 * Sum of per-session distance floors for the types assigned this week (long / easy / quality).
 * Used to bump low progression weeks so distribution never starts from an infeasible total.
 */
function minimumViableWeekKmForTypes(types: readonly RunType[]): number {
  let sum = 0;
  for (const t of types) {
    if (t === "long") sum += MIN_LONG_RUN_KM;
    else if (t === "easy") sum += MIN_EASY_KM;
    else if (t === "tempo" || t === "interval") sum += MIN_TEMPO_INTERVAL_WEEK_KM;
  }
  return sum;
}

/**
 * Initial proportional split, then long-run caps (30% of week only when
 * weekTotalKm >= LONG_FRACTION_WEEK_MIN_KM), easy consolidation, and repeat so the
 * long-run floor (>= longest easy + 2 km, >= 8 km, without breaking the absolute cap)
 * sees up-to-date easy distances after merges.
 */
function finalizeWeeklySessionDistances(
  typesIn: RunType[],
  daysIn: Day[],
  weekTotalKm: number,
  goalDistance: PlanConfigV2["goalDistance"],
  experienceLevel: PlanConfigV2["experienceLevel"],
): { types: RunType[]; days: Day[]; dists: number[] } {
  const types = [...typesIn];
  const days = [...daysIn];
  const n = types.length;
  const weights = distanceWeights(n, types);
  const dists = types.map((_, si) => round1(weekTotalKm * (weights[si] ?? 1 / n)));
  for (let i = 0; i < n; i++) dists[i] = Math.max(0.1, dists[i]);

  applyLongRunDistanceGuards(dists, types, weekTotalKm, goalDistance, experienceLevel);
  consolidateEasyRunDistances(dists, types, days);
  applyLongRunDistanceGuards(dists, types, weekTotalKm, goalDistance, experienceLevel);
  consolidateEasyRunDistances(dists, types, days);
  applyLongRunDistanceGuards(dists, types, weekTotalKm, goalDistance, experienceLevel);

  absorbPositiveWeeklyDrift(dists, types, weekTotalKm);
  applyLongRunDistanceGuards(dists, types, weekTotalKm, goalDistance, experienceLevel);

  return { types, days, dists };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function uniqDaysPreserveOrder(days: Day[]): Day[] {
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

/**
 * Map each session type to a calendar day. Long run always uses `longRunDay` when provided
 * (even if that day is not listed in trainingDays — user override). Other sessions rotate
 * across remaining training days, preferring not to stack on the long-run day when alternatives exist.
 */
export function assignSessionDays(
  types: RunType[],
  trainingDays: Day[],
  longRunDay?: Day | null,
): Day[] {
  const pool = uniqDaysPreserveOrder(trainingDays);
  if (pool.length === 0) {
    throw new Error("assignSessionDays: trainingDays must include at least one day");
  }

  const n = types.length;
  const out: Day[] = new Array(n);
  const longIdx = types.indexOf("long");

  const longDay: Day =
    longRunDay != null ? longRunDay : getDefaultLongRunDay(pool);

  let rotPool = pool.filter((d) => d !== longDay);
  if (rotPool.length === 0) {
    rotPool = [...pool];
  }

  if (longIdx >= 0) {
    out[longIdx] = longDay;
  }

  let r = 0;
  for (let i = 0; i < n; i++) {
    if (i === longIdx) continue;
    out[i] = rotPool[r % rotPool.length]!;
    r++;
  }

  if (longIdx < 0) {
    for (let i = 0; i < n; i++) {
      out[i] = pool[i % pool.length]!;
    }
  }

  return out;
}

export function generatePlanV2(config: PlanConfigV2): TrainingWeek[] {
  const peakBase = PEAK_KM[config.goalDistance][config.experienceLevel];
  const scale = SESSION_SCALE[config.sessionsPerWeek];
  const peakVolumeKm = peakBase * scale;

  const phaseWeeks = getPhaseWeeks(
    config.goalDistance,
    config.experienceLevel,
    config.totalWeeks,
  );
  const phases = flattenPhaseWeeks(phaseWeeks);
  const weeklyKm = buildVolumeProgression(
    config.totalWeeks,
    peakVolumeKm,
    config.experienceLevel,
    phaseWeeks,
  );

  let lastPeakWeekNumber = 0;
  for (let wi = 0; wi < phases.length; wi++) {
    if (phases[wi] === "Peak") lastPeakWeekNumber = wi + 1;
  }

  const paces = getPacesForVdot(config.vdot);
  const weeksOut: TrainingWeek[] = [];

  for (let wi = 0; wi < config.totalWeeks; wi++) {
    const weekNum = wi + 1;
    const planPhase = phases[wi] ?? "Base";
    const isTaperWeek = planPhase === "Taper";
    const types = assignSessionTypes(
      planPhase,
      config.experienceLevel,
      config.sessionsPerWeek,
      config.goalDistance,
    );

    const intPlus =
      config.experienceLevel === "INTERMEDIATE" || config.experienceLevel === "ADVANCED";
    const buildOrPeak = planPhase === "Build" || planPhase === "Peak";
    const isLastPeakWeek = weekNum === lastPeakWeekNumber && planPhase === "Peak";

    const rawWeekKm = weeklyKm[wi] ?? 0;
    const minViableWeekKm = minimumViableWeekKmForTypes(types);
    const weekKmForDistribution = round1(Math.max(rawWeekKm, minViableWeekKm));

    const sessionDays = assignSessionDays(types, config.trainingDays, config.longRunDay ?? null);
    const { types: wTypes, days: wDays, dists: wDists } = finalizeWeeklySessionDistances(
      types,
      sessionDays,
      weekKmForDistribution,
      config.goalDistance,
      config.experienceLevel,
    );
    const sessions: Session[] = [];

    for (let si = 0; si < wTypes.length; si++) {
      const t = wTypes[si]!;
      const day = wDays[si]!;
      const dist = Math.max(0.1, wDists[si] ?? 0.1);

      const isReps =
        t === "interval" &&
        config.goalDistance === "5K" &&
        intPlus &&
        buildOrPeak &&
        wTypes.filter((x) => x === "interval").length > 0 &&
        si === wTypes.indexOf("interval");

      const isRacePace =
        t === "tempo" && isLastPeakWeek && planPhase === "Peak" && config.experienceLevel !== "NOVICE";

      const isCruiseTempo =
        t === "tempo" &&
        config.goalDistance === "10K" &&
        buildOrPeak &&
        !isRacePace;

      const paceMin = paceMinPerKmForType(paces, t, {
        isReps,
        isRacePace,
        goalDistance: config.goalDistance,
      });
      const paceSec = paceSecondsForType(paces, t, {
        isReps,
        isRacePace,
        goalDistance: config.goalDistance,
      });

      const descParams = {
        type: t,
        vdot: config.vdot,
        phase: planPhase,
        level: config.experienceLevel,
        goalDistance: config.goalDistance,
        weekNumber: weekNum,
        totalDistanceKm: dist,
        isTaperWeek,
        isReps,
        isRacePace,
      };

      const description = buildSessionDescription(descParams);
      const targetRpe =
        t === "easy"
          ? 3
          : t === "long"
            ? 4
            : isRacePace
              ? 8
              : t === "tempo"
                ? 7
                : isReps
                  ? 10
                  : 9;

      const cruiseReps = isCruiseTempo ? Math.max(1, Math.floor(dist / 1.6)) : undefined;

      const plannedWorkload = estimateSessionDurationMin(t, dist, paceSec, config.vdot, {
        isReps,
        isCruiseTempo,
        cruiseReps,
        isTaperInterval: isTaperWeek && t === "interval",
      });

      sessions.push({
        id: `${weekNum}-${day}`,
        day,
        type: t,
        targetDistanceKm: dist,
        targetPaceMinPerKm: paceMin,
        targetPaceFormatted: formatPaceMinPerKm(paceSec),
        description,
        targetRpe,
        plannedWorkload,
      });
    }

    sessions.sort((a, b) => DAY_CAL_ORDER[a.day] - DAY_CAL_ORDER[b.day]);

    const cutRule = cutbackRule(config.experienceLevel);
    const isCutback =
      isTaperWeek || (!isTaperWeek && weekNum % cutRule.every === 0 && weekNum > 0);

    weeksOut.push({
      week: weekNum,
      phase: toStoredPhase(planPhase),
      isCutback,
      sessions,
      totalTargetKm: weekKmForDistribution,
    } as TrainingWeek);
  }

  return weeksOut;
}
