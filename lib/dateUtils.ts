import { formatDistance } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";

/** IANA zone — Queensland has no DST; offset is always UTC+10. */
export const BRISBANE_TZ = "Australia/Brisbane";

// Brisbane is always UTC+10 — used for UTC instant math (midnight, year bounds)
export const AEST_OFFSET_MS = 10 * 60 * 60 * 1000;

/**
 * Shifts a UTC Date by +10h so legacy code can read Brisbane wall time via
 * getUTC* (used with plan session comparisons). Prefer formatInTimeZone / toBrisbaneYmd for new code.
 */
export function toAEST(date: Date | string): Date {
  return new Date(new Date(date).getTime() + AEST_OFFSET_MS);
}

/** Format an instant in Brisbane civil time. */
export function formatAEST(date: Date | string, fmt: string): string {
  return formatInTimeZone(new Date(date), BRISBANE_TZ, fmt);
}

/**
 * Relative time from real UTC instants (correct elapsed time).
 */
export function formatDistanceToNowAEST(
  date: Date | string,
  options?: { addSuffix?: boolean }
): string {
  return formatDistance(new Date(date), new Date(), options);
}

/**
 * Brisbane calendar date as `yyyy-MM-dd` — use for calendar keys, grouping, and filters.
 */
export function toBrisbaneYmd(date: Date | string): string {
  return formatInTimeZone(new Date(date), BRISBANE_TZ, "yyyy-MM-dd");
}

/**
 * `yyyy-MM-dd` interpreted as a Brisbane **calendar** day → UTC instant of that day's
 * 00:00 in Brisbane (same as {@link startOfDayAEST} for that wall date).
 */
export function brisbaneMidnightUtcForYmd(ymd: string): Date {
  const parts = ymd.split("-").map(Number);
  const y = parts[0];
  const mo = parts[1];
  const d = parts[2];
  if (!y || !mo || !d) throw new Error(`Invalid yyyy-MM-dd: ${ymd}`);
  return new Date(Date.UTC(y, mo - 1, d, 0, 0, 0, 0) - AEST_OFFSET_MS);
}

/** Inclusive start and exclusive end for all activities whose Brisbane date falls in `year`. */
export function brisbaneCalendarYearUtcRange(year: number): { start: Date; endExclusive: Date } {
  return {
    start:        brisbaneMidnightUtcForYmd(`${year}-01-01`),
    endExclusive: brisbaneMidnightUtcForYmd(`${year + 1}-01-01`),
  };
}

/**
 * UTC instant of Brisbane midnight on the same Brisbane calendar day as `date`.
 */
export function startOfDayAEST(date: Date | string): Date {
  return brisbaneMidnightUtcForYmd(toBrisbaneYmd(date));
}

/**
 * Returns true if two instants fall on the same Brisbane calendar day.
 */
export function sameDayAEST(a: Date, b: Date): boolean {
  return toBrisbaneYmd(a) === toBrisbaneYmd(b);
}

/** UTC instant of the next Brisbane midnight after `ref`'s Brisbane calendar day. */
export function startOfNextDayAEST(ref: Date | string): Date {
  return new Date(startOfDayAEST(ref).getTime() + 24 * 60 * 60 * 1000);
}

/** First moment (UTC) of the Brisbane calendar month that contains `date`. */
export function startOfBrisbaneMonthContaining(date: Date | string): Date {
  const ymd = formatInTimeZone(new Date(date), BRISBANE_TZ, "yyyy-MM") + "-01";
  return brisbaneMidnightUtcForYmd(ymd);
}

/** Brisbane wall-clock hour (0–23) for the instant. */
export function brisbaneHour(date: Date | string): number {
  return parseInt(formatInTimeZone(new Date(date), BRISBANE_TZ, "H"), 10);
}
