import type { TrainingWeek, Session, Phase, RunType, Day } from "@/data/trainingPlan";
import { toAEST } from "@/lib/dateUtils";

// AEST midnight Saturday 3 May 2026 = UTC 2026-05-02T14:00:00.000Z
export const PLAN_START_DATE = new Date("2026-05-02T14:00:00.000Z");

/** Returns 1-indexed plan week for a given date. Returns 0 if before plan start. */
export function getPlanWeekForDate(date: Date): number {
  const diff = date.getTime() - PLAN_START_DATE.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days < 0) return 0;
  return Math.floor(days / 7) + 1;
}

/** Returns the AEST-midnight Saturday that starts a given plan week (as UTC timestamp). */
export function getWeekStartForPlanWeek(weekNumber: number): Date {
  const ms = PLAN_START_DATE.getTime() + (weekNumber - 1) * 7 * 24 * 60 * 60 * 1000;
  return new Date(ms);
}

/**
 * Returns the calendar date for a session day within a given week.
 * Week starts on Saturday (plan start date's weekday).
 *   sat → +0 days, sun → +1 day, wed → +4 days
 */
export function getSessionDate(weekNumber: number, day: Day): Date {
  const weekStart = getWeekStartForPlanWeek(weekNumber);
  const offsets: Record<Day, number> = { sat: 0, sun: 1, wed: 4 };
  const d = new Date(weekStart);
  d.setDate(d.getDate() + offsets[day]);
  return d;
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

/** Returns the label and start week of the next phase, or null if on the last phase. */
export function getNextPhaseInfo(
  phase: Phase
): { label: Phase; week: number } | null {
  switch (phase) {
    case "Base":                return { label: "Half Marathon Build", week: 7  };
    case "Half Marathon Build": return { label: "Marathon Build",       week: 15 };
    case "Marathon Build":      return null;
  }
}
