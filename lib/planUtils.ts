import type { TrainingWeek, Phase, Day } from "@/data/trainingPlan";
import { toAEST, toBrisbaneYmd, startOfDayAEST } from "@/lib/dateUtils";

// Default week anchor when UserSettings.planStartDate is null (sat+0, sun+1, wed+4 from this Saturday).
export const PLAN_START_DATE = new Date("2026-05-01T14:00:00.000Z");

/** Mon-first week order used to find the earliest training day of a week (Mon=0 … Sun=6). */
const DAY_MON_FIRST_ORDER: Record<Day, number> = { mon: 0, tue: 1, wed: 2, thu: 3, fri: 4, sat: 5, sun: 6 };

/** Parses the trainingDays JSON string and returns the earliest training day in Mon–Sun order. */
export function parsePlanFirstSessionDay(trainingDaysJson: string | null | undefined): Day | null {
  if (!trainingDaysJson) return null;
  try {
    const days = JSON.parse(trainingDaysJson) as Day[];
    if (!Array.isArray(days) || days.length === 0) return null;
    return days.reduce((a, b) => DAY_MON_FIRST_ORDER[a] <= DAY_MON_FIRST_ORDER[b] ? a : b);
  } catch {
    return null;
  }
}

/**
 * Plan week anchor from settings ISO string, or {@link PLAN_START_DATE} if unset.
 *
 * When `firstSessionDay` is supplied the function applies week-anchoring:
 * - If the selected date falls on or before the first session day of the same Mon–Sun calendar
 *   week, the effective start is anchored to that first session day.
 * - If the selected date falls after it (meaning at least one session would already be missed),
 *   the effective start advances to the same day in the following week.
 */
export function getEffectivePlanStart(
  planStartIso: string | null | undefined,
  firstSessionDay?: Day | null,
): Date {
  if (!planStartIso || !planStartIso.trim()) return PLAN_START_DATE;
  const rawDate = new Date(planStartIso);
  if (!firstSessionDay) return rawDate;

  // rawDate's Brisbane weekday after +10 h shift (Sun=0, Mon=1 … Sat=6)
  const rawUtcDay = toAEST(rawDate).getUTCDay();
  // Days since the preceding Monday in rawDate's Brisbane calendar week
  const daysSinceMon = (rawUtcDay - 1 + 7) % 7;
  // UTC instant of that Monday
  const mondayInstant = new Date(rawDate.getTime() - daysSinceMon * MS_PER_DAY);
  // UTC instant of the first session day within that same Mon–Sun week
  // DAY_UTC_INDEX is defined below; safe to use here since this fn is only called at runtime.
  const firstUtcDay = DAY_UTC_INDEX[firstSessionDay]; // Sun=0 … Sat=6
  const offsetFromMon = (firstUtcDay - 1 + 7) % 7;
  const firstSessionInstant = new Date(mondayInstant.getTime() + offsetFromMon * MS_PER_DAY);

  // Compare as Brisbane calendar date strings (timezone-safe)
  if (toBrisbaneYmd(rawDate) <= toBrisbaneYmd(firstSessionInstant)) {
    return firstSessionInstant; // on or before → anchor to this first session day
  }
  return new Date(firstSessionInstant.getTime() + 7 * MS_PER_DAY); // after → advance one week
}

/** True when the activity falls on or after the plan start calendar day (Brisbane). */
export function isActivityOnOrAfterPlanStart(activityDate: Date, planStart: Date): boolean {
  return toBrisbaneYmd(activityDate) >= toBrisbaneYmd(planStart);
}

/** Returns 1-indexed plan week for a given date. Returns 0 if before plan start calendar day (Brisbane). */
export function getPlanWeekForDate(date: Date, planStart: Date): number {
  const dateDay = startOfDayAEST(date);
  const planDay = startOfDayAEST(planStart);
  if (dateDay.getTime() < planDay.getTime()) return 0;
  const days = (dateDay.getTime() - planDay.getTime()) / MS_PER_DAY;
  return Math.floor(days / 7) + 1;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// Day indices matching JS Date.getUTCDay() on AEST-shifted instants (Sun=0, Mon=1 … Sat=6)
const DAY_UTC_INDEX: Record<Day, number> = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };

/**
 * Returns the plan week's anchor instant — identical origin to getPlanWeekForDate so the two
 * functions stay consistent. Week 1 starts at planStart; every subsequent week is +7 days.
 */
export function getWeekStartForPlanWeek(weekNumber: number, planStart: Date): Date {
  return new Date(planStart.getTime() + (weekNumber - 1) * 7 * MS_PER_DAY);
}

/**
 * Returns the session date for a plan week/day, anchored to planStart's calendar day.
 * Day offsets are computed forward (0–6) from planStart's Brisbane weekday, so every
 * Week 1 session falls on or after planStart — never before it.
 */
export function getSessionDate(weekNumber: number, day: Day, planStart: Date): Date {
  const weekStart = getWeekStartForPlanWeek(weekNumber, planStart);
  // planStart's Brisbane weekday — toAEST shifts the instant so UTC fields mirror wall time.
  const planDayIndex = toAEST(planStart).getUTCDay();
  // Forward offset (0–6): how many days ahead of planStart's weekday is the target day?
  const offset = (DAY_UTC_INDEX[day] - planDayIndex + 7) % 7;
  return new Date(weekStart.getTime() + offset * MS_PER_DAY);
}

/** Total planned km across all sessions in a week. */
export function getWeeklyTargetKm(week: TrainingWeek): number {
  return week.sessions.reduce((s, sess) => s + sess.targetDistanceKm, 0);
}

/** Returns true when `date` falls on a planned session AEST calendar day (on/after plan start). */
export function isPlannedRun(date: Date, plan: TrainingWeek[], planStart: Date): boolean {
  if (!isActivityOnOrAfterPlanStart(date, planStart)) return false;
  const weekNum = getPlanWeekForDate(date, planStart);
  if (weekNum <= 0 || weekNum > plan.length) return false;
  const planWeek = plan[weekNum - 1];
  const da = toAEST(date);
  return planWeek.sessions.some(s => {
    const sd = toAEST(getSessionDate(weekNum, s.day, planStart));
    return (
      da.getUTCFullYear() === sd.getUTCFullYear() &&
      da.getUTCMonth()    === sd.getUTCMonth()    &&
      da.getUTCDate()     === sd.getUTCDate()
    );
  });
}

/** Returns the label and start week of the next phase, or null if on the last phase. */
export function getNextPhaseInfo(
  phase: Phase
): { label: Phase; week: number } | null {
  switch (phase) {
    case "Base":                return { label: "Half Marathon Build", week: 7  };
    case "Half Marathon Build": return { label: "Marathon Build",       week: 15 };
    case "Marathon Build":      return null;
    case "Recovery":            return null;
    case "Beginner Base":       return { label: "Race Specific",        week: 1 };
    case "Intermediate Base":   return { label: "Race Specific",        week: 1 };
    case "Advanced Base":       return { label: "Race Specific",        week: 1 };
    case "Race Specific":       return { label: "Taper",                week: 1 };
    case "Taper":               return null;
  }
}
