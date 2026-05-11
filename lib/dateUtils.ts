import { formatDistance } from "date-fns";
import { formatInTimeZone, getTimezoneOffset } from "date-fns-tz";

export const DEFAULT_TZ = "Australia/Brisbane";

export function getTzOffsetMs(date: Date | string, tz: string = DEFAULT_TZ): number {
  return getTimezoneOffset(tz, new Date(date));
}

/** Shifts a UTC instant by timezone offset and returns a Date whose UTC fields mirror wall time. */
export function toAEST(date: Date | string, tz: string = DEFAULT_TZ): Date {
  return new Date(new Date(date).getTime() + getTzOffsetMs(date, tz));
}

/** Format an instant in local civil time. */
export function formatAEST(date: Date | string, fmt: string, tz: string = DEFAULT_TZ): string {
  return formatInTimeZone(new Date(date), tz, fmt);
}

/** Formats elapsed distance from now and returns a relative time string. */
export function formatDistanceToNowAEST(
  date: Date | string,
  options?: { addSuffix?: boolean }
): string {
  return formatDistance(new Date(date), new Date(), options);
}

/** Formats an instant as a calendar date key and returns `yyyy-MM-dd`. */
export function toBrisbaneYmd(date: Date | string, tz: string = DEFAULT_TZ): string {
  return formatInTimeZone(new Date(date), tz, "yyyy-MM-dd");
}

/** Interprets `yyyy-MM-dd` as a local calendar day and returns its UTC midnight instant. */
export function brisbaneMidnightUtcForYmd(ymd: string, tz: string = DEFAULT_TZ): Date {
  const parts = ymd.split("-").map(Number);
  const y = parts[0];
  const mo = parts[1];
  const d = parts[2];
  if (!y || !mo || !d) throw new Error(`Invalid yyyy-MM-dd: ${ymd}`);
  const utcGuess = new Date(Date.UTC(y, mo - 1, d, 0, 0, 0, 0));
  const offset = getTimezoneOffset(tz, utcGuess);
  return new Date(utcGuess.getTime() - offset);
}

/** Inclusive start and exclusive end for all activities whose date falls in `year`. */
export function brisbaneCalendarYearUtcRange(year: number, tz: string = DEFAULT_TZ): { start: Date; endExclusive: Date } {
  return {
    start:        brisbaneMidnightUtcForYmd(`${year}-01-01`, tz),
    endExclusive: brisbaneMidnightUtcForYmd(`${year + 1}-01-01`, tz),
  };
}

/** Finds the local calendar day containing `date` and returns its UTC midnight instant. */
export function startOfDayAEST(date: Date | string, tz: string = DEFAULT_TZ): Date {
  return brisbaneMidnightUtcForYmd(toBrisbaneYmd(date, tz), tz);
}

/** Compares two instants and returns true when they share the same local calendar day. */
export function sameDayAEST(a: Date, b: Date, tz: string = DEFAULT_TZ): boolean {
  return toBrisbaneYmd(a, tz) === toBrisbaneYmd(b, tz);
}

/** UTC instant of the next midnight after `ref`'s local calendar day. */
export function startOfNextDayAEST(ref: Date | string, tz: string = DEFAULT_TZ): Date {
  const currentYmd = toBrisbaneYmd(ref, tz);
  const currentMidnight = brisbaneMidnightUtcForYmd(currentYmd, tz);
  // Add 24h as a safe baseline since we just need "the next day", though DST could make it 23 or 25. 
  // date-fns addDays would be safer, but 24h is mostly fine. Let's do it safely:
  const parts = currentYmd.split("-").map(Number);
  const nextUtcGuess = new Date(Date.UTC(parts[0]!, parts[1]! - 1, parts[2]! + 1, 0, 0, 0, 0));
  const offset = getTimezoneOffset(tz, nextUtcGuess);
  return new Date(nextUtcGuess.getTime() - offset);
}

/** First moment (UTC) of the calendar month that contains `date`. */
export function startOfBrisbaneMonthContaining(date: Date | string, tz: string = DEFAULT_TZ): Date {
  const ymd = formatInTimeZone(new Date(date), tz, "yyyy-MM") + "-01";
  return brisbaneMidnightUtcForYmd(ymd, tz);
}

/** Local wall-clock hour (0–23) for the instant. */
export function brisbaneHour(date: Date | string, tz: string = DEFAULT_TZ): number {
  return parseInt(formatInTimeZone(new Date(date), tz, "H"), 10);
}

/** Returns the start of the training week (Monday 00:00:00) for the given date. */
export function getStartOfTrainingWeek(date: Date = new Date()): Date {
  const d = new Date(date);
  const day = d.getDay();
  // day: 0=Sun, 1=Mon, ..., 6=Sat
  // Monday start: if Sun (0), go back 6 days. If Mon (1), go back 0. If Tue (2), go back 1.
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}
