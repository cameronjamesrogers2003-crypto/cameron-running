import type { TrainingWeek, Session, Phase, RunType, Day } from "@/data/trainingPlan";
import { toAEST, toBrisbaneYmd } from "@/lib/dateUtils";

// Default week anchor when UserSettings.planStartDate is null (sat+0, sun+1, wed+4 from this Saturday)
export const PLAN_START_DATE = new Date("2026-05-01T14:00:00.000Z");

/** Plan week anchor from settings ISO string, or {@link PLAN_START_DATE} if unset. */
export function getEffectivePlanStart(planStartIso: string | null | undefined): Date {
  if (planStartIso && planStartIso.trim()) return new Date(planStartIso);
  return PLAN_START_DATE;
}

/** True when the activity falls on or after the plan start calendar day (Brisbane). */
export function isActivityOnOrAfterPlanStart(activityDate: Date, planStart: Date): boolean {
  return toBrisbaneYmd(activityDate) >= toBrisbaneYmd(planStart);
}

/** Returns 1-indexed plan week for a given date. Returns 0 if before plan start anchor. */
export function getPlanWeekForDate(date: Date, planStart: Date): number {
  const diff = date.getTime() - planStart.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days < 0) return 0;
  return Math.floor(days / 7) + 1;
}

/** Returns the week anchor instant that starts a given plan week (same origin as planStart). */
export function getWeekStartForPlanWeek(weekNumber: number, planStart: Date): Date {
  const ms = planStart.getTime() + (weekNumber - 1) * 7 * 24 * 60 * 60 * 1000;
  return new Date(ms);
}

/**
 * Returns the calendar date for a session day within a given week.
 * Week starts on Saturday (plan start date's weekday).
 *   sat → +0 days, sun → +1 day, wed → +4 days
 */
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function getSessionDate(weekNumber: number, day: Day, planStart: Date): Date {
  const weekStart = getWeekStartForPlanWeek(weekNumber, planStart);
  const offsets: Record<Day, number> = { sat: 0, sun: 1, wed: 4 };
  // Whole-day offsets from week anchor (Brisbane week; no DST) — do not use setDate/getDate
  // (those use the host timezone and shift session dates on UTC servers).
  return new Date(weekStart.getTime() + offsets[day] * MS_PER_DAY);
}

/** Total planned km across all sessions in a week. */
export function getWeeklyTargetKm(week: TrainingWeek): number {
  return week.sessions.reduce((s, sess) => s + sess.targetDistanceKm, 0);
}

/**
 * Infers run type by matching day-of-week (in AEST) to a planned session.
 * Falls back to distance/pace heuristics when no match is found.
 */
export function inferRunType(
  activity: { distanceKm: number; avgPaceSecKm: number; date: Date | string },
  sessions?: Session[]
): RunType {
  if (sessions) {
    const dow = toAEST(new Date(activity.date)).getUTCDay(); // 0=Sun, 3=Wed, 6=Sat in AEST
    const dowMap: Record<Day, number> = { sat: 6, sun: 0, wed: 3 };
    const match = sessions.find((s) => dowMap[s.day] === dow);
    if (match) return match.type;
  }
  if (activity.distanceKm >= 14) return "long";
  if (activity.avgPaceSecKm <= 330) return "interval"; // < 5:30/km
  if (activity.avgPaceSecKm <= 365) return "tempo";    // < 6:05/km
  return "easy";
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
  }
}
