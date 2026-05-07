export interface VdotPaces {
  easyMinSecKm: number;
  easyMaxSecKm: number;
  tempoSecKm: number;
  intervalSecKm: number;
  marathonSecKm: number;
}

// Anchor points from Jack Daniels' Running Formula VDOT table
// All values in sec/km
const ANCHORS: Array<[number, VdotPaces]> = [
  [28, { easyMinSecKm: 430, easyMaxSecKm: 484, tempoSecKm: 362, intervalSecKm: 330, marathonSecKm: 401 }],
  [30, { easyMinSecKm: 413, easyMaxSecKm: 464, tempoSecKm: 346, intervalSecKm: 314, marathonSecKm: 381 }],
  [33, { easyMinSecKm: 390, easyMaxSecKm: 435, tempoSecKm: 322, intervalSecKm: 292, marathonSecKm: 357 }],
  [35, { easyMinSecKm: 375, easyMaxSecKm: 420, tempoSecKm: 308, intervalSecKm: 279, marathonSecKm: 342 }],
  [40, { easyMinSecKm: 348, easyMaxSecKm: 387, tempoSecKm: 280, intervalSecKm: 252, marathonSecKm: 309 }],
  [45, { easyMinSecKm: 321, easyMaxSecKm: 357, tempoSecKm: 257, intervalSecKm: 230, marathonSecKm: 283 }],
  [50, { easyMinSecKm: 295, easyMaxSecKm: 328, tempoSecKm: 238, intervalSecKm: 213, marathonSecKm: 262 }],
  [55, { easyMinSecKm: 276, easyMaxSecKm: 307, tempoSecKm: 221, intervalSecKm: 199, marathonSecKm: 245 }],
  [60, { easyMinSecKm: 254, easyMaxSecKm: 283, tempoSecKm: 208, intervalSecKm: 187, marathonSecKm: 226 }],
];

export function getVdotPaces(vdot: number): VdotPaces {
  const clamped = Math.max(28, Math.min(60, vdot));

  for (let i = 0; i < ANCHORS.length - 1; i++) {
    const [v0, p0] = ANCHORS[i];
    const [v1, p1] = ANCHORS[i + 1];
    if (clamped >= v0 && clamped <= v1) {
      const t = (clamped - v0) / (v1 - v0);
      return {
        easyMinSecKm:  Math.round(p0.easyMinSecKm  + t * (p1.easyMinSecKm  - p0.easyMinSecKm)),
        easyMaxSecKm:  Math.round(p0.easyMaxSecKm  + t * (p1.easyMaxSecKm  - p0.easyMaxSecKm)),
        tempoSecKm:    Math.round(p0.tempoSecKm    + t * (p1.tempoSecKm    - p0.tempoSecKm)),
        intervalSecKm: Math.round(p0.intervalSecKm + t * (p1.intervalSecKm - p0.intervalSecKm)),
        marathonSecKm: Math.round(p0.marathonSecKm + t * (p1.marathonSecKm - p0.marathonSecKm)),
      };
    }
  }

  return ANCHORS[ANCHORS.length - 1][1];
}

/** Jack Daniels / Daniels formula: VO₂ from race velocity and duration (minutes). */
export function estimateVo2FromRace(metres: number, durationMinutes: number): number | null {
  if (durationMinutes <= 0) return null;
  const velocity = metres / durationMinutes;
  const pct =
    0.8
    + 0.1894393 * Math.exp(-0.012778 * durationMinutes)
    + 0.2989558 * Math.exp(-0.1932605 * durationMinutes);
  if (pct <= 0) return null;
  const vo2 = (-4.6 + 0.182258 * velocity + 0.000104 * velocity * velocity) / pct;
  return Number.isFinite(vo2) && vo2 > 0 ? vo2 : null;
}

/** Unadjusted integer VDOT from a single race (rounded VO₂). */
export function rawVdotFromRace(metres: number, minutes: number, seconds: number): number | null {
  const t = minutes + seconds / 60;
  const vo2 = estimateVo2FromRace(metres, t);
  if (vo2 == null) return null;
  return Math.max(1, Math.round(vo2));
}

export type WinningRaceKey = "5" | "10" | "21.1";

export interface MultiRaceVdotResult {
  rawVdot: number;
  adjustedVdot: number;
  displayVo2: number;
  winningDistanceKey: WinningRaceKey;
}

export function adjustedVdotFromRaw(rawVdot: number, age: number | null | undefined, runningExperience: string | null | undefined): number {
  let v = rawVdot;
  if (age != null && Number.isFinite(age)) {
    if (age >= 60) v -= 3;
    else if (age >= 50) v -= 2;
    else if (age >= 40) v -= 1;
  }
  if (runningExperience === "< 1 year") v -= 2;
  else if (runningExperience === "1-3 years") v -= 1;
  return Math.max(28, Math.min(60, v));
}

/**
 * From 5K / 10K / HM times (each optional). Uses highest raw VDOT among filled races, then age & experience adjustments.
 */
export function computeVdotFromRaceTimes(
  races: {
    fiveKm: { minutes: number; seconds: number } | null;
    tenKm: { minutes: number; seconds: number } | null;
    half: { minutes: number; seconds: number } | null;
  },
  age: number | null | undefined,
  runningExperience: string | null | undefined,
): MultiRaceVdotResult | null {
  type Cand = { key: WinningRaceKey; metres: number; minutes: number; seconds: number; raw: number; vo2: number };
  const cands: Cand[] = [];
  const tryPush = (key: WinningRaceKey, metres: number, minutes: number, seconds: number) => {
    if (minutes < 0 || seconds < 0 || seconds > 59) return;
    const t = minutes + seconds / 60;
    if (t <= 0) return;
    const vo2 = estimateVo2FromRace(metres, t);
    if (vo2 == null) return;
    const raw = Math.max(1, Math.round(vo2));
    cands.push({ key, metres, minutes, seconds, raw, vo2 });
  };
  if (races.fiveKm) tryPush("5", 5000, races.fiveKm.minutes, races.fiveKm.seconds);
  if (races.tenKm) tryPush("10", 10000, races.tenKm.minutes, races.tenKm.seconds);
  if (races.half) tryPush("21.1", 21097.5, races.half.minutes, races.half.seconds);

  if (cands.length === 0) return null;
  const best = cands.reduce((a, b) => (b.raw > a.raw ? b : a));
  const adjustedVdot = adjustedVdotFromRaw(best.raw, age, runningExperience);
  return {
    rawVdot: best.raw,
    adjustedVdot,
    displayVo2: best.vo2,
    winningDistanceKey: best.key,
  };
}

export function fitnessIdentityLabel(adjustedVdot: number): string {
  if (adjustedVdot < 35) return "Beginner Aerobic Base";
  if (adjustedVdot < 45) return "Developing Runner";
  if (adjustedVdot < 55) return "Intermediate Endurance";
  return "Advanced Aerobic Fitness";
}

export type SuggestedTrainingLevel = "BEGINNER" | "INTERMEDIATE" | "ADVANCED";

export function suggestedLevelFromVdot(adjustedVdot: number): SuggestedTrainingLevel {
  if (adjustedVdot < 35) return "BEGINNER";
  if (adjustedVdot < 50) return "INTERMEDIATE";
  return "ADVANCED";
}
