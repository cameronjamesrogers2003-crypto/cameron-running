/**
 * Traffic-light palette for *run ratings* on the Calendar page only.
 * Intentionally separate from run-type tokens (--c-easy, --c-tempo, etc.).
 * Unified thresholds: Elite ≥8.5, Strong ≥7.0, Solid ≥5.5, Rough ≥4.0, Off Day <4.0.
 */
const TINT_A = 0.11;

export function calendarRatingTextColor(score: number): string {
  if (score >= 8.5) return "#22c55e";
  if (score >= 7.0) return "#f59e0b";
  if (score >= 5.5) return "#f97316";
  if (score >= 4.0) return "#ef4444";
  return "#ef4444";
}

export function calendarRatingBadgeStyle(score: number): { bg: string; color: string } {
  if (score >= 8.5) return { bg: "rgba(34,197,94,0.25)", color: "#22c55e" };
  if (score >= 7.0) return { bg: "rgba(245,158,11,0.25)", color: "#f59e0b" };
  if (score >= 5.5) return { bg: "rgba(249,115,22,0.25)", color: "#f97316" };
  if (score >= 4.0) return { bg: "rgba(239,68,68,0.25)", color: "#ef4444" };
  return { bg: "rgba(239,68,68,0.25)", color: "#ef4444" };
}

export function calendarRatingCellTint(score: number): string {
  if (score >= 8.5) return `rgba(34,197,94,${TINT_A})`;
  if (score >= 7.0) return `rgba(245,158,11,${TINT_A})`;
  if (score >= 5.5) return `rgba(249,115,22,${TINT_A})`;
  if (score >= 4.0) return `rgba(239,68,68,${TINT_A})`;
  return `rgba(239,68,68,${TINT_A})`;
}

export function calendarRatingBand(score: number): string {
  if (score >= 8.5) return "Elite";
  if (score >= 7.0) return "Strong";
  if (score >= 5.5) return "Solid";
  if (score >= 4.0) return "Rough";
  return "Off Day";
}
