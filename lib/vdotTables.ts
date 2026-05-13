/** VDOT pace table — all paces in seconds per km. */

export interface VdotPaces {
  easy: number;
  marathon: number;
  threshold: number;
  interval: number;
  repetition: number;
}

export type VdotTableKey = 30 | 32 | 35 | 37 | 40 | 42 | 45 | 48 | 50 | 52 | 55 | 58 | 60;

export const VDOT_TABLE_KEYS: VdotTableKey[] = [30, 32, 35, 37, 40, 42, 45, 48, 50, 52, 55, 58, 60];

export const VDOT_TABLE: Record<VdotTableKey, VdotPaces> = {
  30: { easy: 472, marathon: 413, threshold: 381, interval: 352, repetition: 332 },
  32: { easy: 450, marathon: 398, threshold: 365, interval: 338, repetition: 318 },
  35: { easy: 420, marathon: 377, threshold: 347, interval: 320, repetition: 302 },
  37: { easy: 400, marathon: 356, threshold: 329, interval: 304, repetition: 288 },
  40: { easy: 378, marathon: 337, threshold: 302, interval: 277, repetition: 258 },
  42: { easy: 360, marathon: 324, threshold: 291, interval: 270, repetition: 250 },
  45: { easy: 344, marathon: 289, threshold: 265, interval: 244, repetition: 225 },
  48: { easy: 322, marathon: 269, threshold: 249, interval: 230, repetition: 212 },
  50: { easy: 317, marathon: 259, threshold: 235, interval: 217, repetition: 200 },
  52: { easy: 305, marathon: 249, threshold: 229, interval: 211, repetition: 195 },
  55: { easy: 294, marathon: 234, threshold: 211, interval: 195, repetition: 181 },
  58: { easy: 282, marathon: 221, threshold: 199, interval: 184, repetition: 170 },
  60: { easy: 273, marathon: 213, threshold: 190, interval: 175, repetition: 162 },
};

export function getPacesForVdot(vdot: number): VdotPaces {
  let bestKey: VdotTableKey = 30;
  let bestDiff = Infinity;
  for (const key of VDOT_TABLE_KEYS) {
    const d = Math.abs(vdot - key);
    if (d < bestDiff) {
      bestDiff = d;
      bestKey = key;
    }
  }
  return VDOT_TABLE[bestKey];
}

/** Format seconds/km as "M:SS" per km (e.g. 317 → "5:17"). */
export function formatPaceMinPerKm(secondsPerKm: number): string {
  const totalSec = Math.round(secondsPerKm);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/** Decimal minutes per km (e.g. 317 → 5.2833…). */
export function secondsPerKmToMinPerKm(secondsPerKm: number): number {
  return secondsPerKm / 60;
}

export interface HrZoneRow {
  zone: number;
  minPctMaxHr: number;
  maxPctMaxHr: number;
  rpeMin: number;
  rpeMax: number;
  label: string;
}

/** Percent HR as fraction of max HR (0–1). */
export const HR_ZONES: readonly HrZoneRow[] = [
  { zone: 1, minPctMaxHr: 0, maxPctMaxHr: 0.65, rpeMin: 1, rpeMax: 2, label: "Recovery" },
  { zone: 2, minPctMaxHr: 0.65, maxPctMaxHr: 0.78, rpeMin: 3, rpeMax: 4, label: "Easy / Long" },
  { zone: 3, minPctMaxHr: 0.79, maxPctMaxHr: 0.87, rpeMin: 5, rpeMax: 6, label: "Marathon Pace" },
  { zone: 4, minPctMaxHr: 0.88, maxPctMaxHr: 0.92, rpeMin: 7, rpeMax: 8, label: "Threshold" },
  { zone: 5, minPctMaxHr: 0.93, maxPctMaxHr: 1.0, rpeMin: 9, rpeMax: 10, label: "Interval / Speed" },
] as const;

export interface HeatModifierRow {
  stdpMin: number;
  stdpMax: number;
  multiplier: number | null;
}

/** STDP = tempF + dewPointF. multiplier null means RPE-only for STDP > 140 (handled in applyHeatModifier). */
export const HEAT_MODIFIERS: readonly HeatModifierRow[] = [
  { stdpMin: 101, stdpMax: 110, multiplier: 1.005 },
  { stdpMin: 111, stdpMax: 120, multiplier: 1.01 },
  { stdpMin: 121, stdpMax: 130, multiplier: 1.025 },
  { stdpMin: 131, stdpMax: 140, multiplier: 1.045 },
] as const;

export function applyHeatModifier(
  paceSecondsPerKm: number,
  tempF: number,
  dewPointF: number,
): { adjustedPace: number; rpeOnly: boolean } {
  const stdp = tempF + dewPointF;
  if (stdp <= 100) {
    return { adjustedPace: paceSecondsPerKm, rpeOnly: false };
  }
  if (stdp > 140) {
    return { adjustedPace: paceSecondsPerKm, rpeOnly: true };
  }
  const row = HEAT_MODIFIERS.find((h) => stdp >= h.stdpMin && stdp <= h.stdpMax);
  const mult = row?.multiplier ?? 1;
  return { adjustedPace: paceSecondsPerKm * mult, rpeOnly: false };
}

export function applyAltitudeModifier(
  paceSecondsPerKm: number,
  elevationMeters: number,
  isAcclimatized: boolean,
): number {
  if (elevationMeters <= 500) {
    return paceSecondsPerKm;
  }
  const thousandsAbove500 = (elevationMeters - 500) / 1000;
  const rawLoss = 1 - 0.063 * thousandsAbove500;
  const loss = isAcclimatized ? rawLoss + (1 - rawLoss) * 0.35 : rawLoss;
  const adjustedVdotFactor = loss;
  return paceSecondsPerKm / adjustedVdotFactor;
}
