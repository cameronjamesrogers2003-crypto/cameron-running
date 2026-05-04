import { format as dateFnsFormat, formatDistanceToNow } from "date-fns";

// Brisbane is always UTC+10 — no daylight saving observed
export const AEST_OFFSET_MS = 10 * 60 * 60 * 1000;

/**
 * Shifts a UTC Date by +10h so that date-fns formats it as if the server
 * were in AEST. Safe to use in server components (Node/Vercel runs UTC).
 */
export function toAEST(date: Date): Date {
  return new Date(date.getTime() + AEST_OFFSET_MS);
}

/** date-fns format() wrapper that displays dates in AEST. */
export function formatAEST(date: Date | string, fmt: string): string {
  return dateFnsFormat(toAEST(new Date(date)), fmt);
}

/**
 * Relative time (e.g. "3 hours ago", "yesterday") using the same AEST wall-clock
 * basis as formatAEST, for consistent copy on a UTC server.
 */
export function formatDistanceToNowAEST(
  date: Date | string,
  options?: { addSuffix?: boolean }
): string {
  const d = toAEST(new Date(date));
  const baseDate = toAEST(new Date());
  return formatDistanceToNow(d, { ...options, baseDate });
}

/**
 * Returns the UTC timestamp that corresponds to AEST midnight on the same
 * calendar day as the given UTC date (when read in Brisbane time).
 * e.g. 2026-05-03T03:00Z (1 pm AEST Sat) → 2026-05-02T14:00Z (AEST midnight Sat)
 */
export function startOfDayAEST(date: Date): Date {
  const a = toAEST(date);
  return new Date(
    Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), a.getUTCDate()) - AEST_OFFSET_MS
  );
}

/**
 * Returns true if two UTC Dates fall on the same calendar day in Brisbane time.
 * Use this instead of comparing getDate() directly in UTC.
 */
export function sameDayAEST(a: Date, b: Date): boolean {
  const aa = toAEST(a);
  const bb = toAEST(b);
  return (
    aa.getUTCFullYear() === bb.getUTCFullYear() &&
    aa.getUTCMonth()    === bb.getUTCMonth()    &&
    aa.getUTCDate()     === bb.getUTCDate()
  );
}
