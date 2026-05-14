/**
 * Training plan distances (session targets, week totals, recovery weeks) use a 0.25 km grid
 * so stored values match GPS / track splits and .fit tooling.
 */
export function roundProgramDistanceKm(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 4) / 4;
}

/** Display string for a planned distance on the 0.25 km grid (no misleading one-decimal rounding). */
export function formatProgramDistanceKm(km: number): string {
  const r = roundProgramDistanceKm(km);
  let s = r.toFixed(2);
  if (s.endsWith("0")) s = s.slice(0, -1);
  if (s.endsWith("0")) s = s.slice(0, -1);
  if (s.endsWith(".")) s = s.slice(0, -1);
  return s;
}
