export type WorkoutType =
  | "rest"
  | "easy"
  | "long"
  | "cross"
  | "race_5k"
  | "race_10k"
  | "race_half"
  | "race_marathon"
  | "sorta_long";

export interface DayWorkout {
  type: WorkoutType;
  distanceKm?: number;
  durationMins?: number;
  label: string;
}

export interface WeekPlan {
  week: number;
  mon: DayWorkout;
  tue: DayWorkout;
  wed: DayWorkout;
  thu: DayWorkout;
  fri: DayWorkout;
  sat: DayWorkout;
  sun: DayWorkout;
}

export type PlanId = "half" | "marathon";

// Cameron trains Wed / Sat / Sun only — all 3 are running days
export const TRAINING_DAYS: Set<DayKey> = new Set(["wed", "sat", "sun"]);

const rest: DayWorkout = { type: "rest", label: "Rest" };

function easy(distanceKm: number): DayWorkout {
  return { type: "easy", distanceKm, label: `${distanceKm.toFixed(1)} km easy` };
}

function sortaLong(distanceKm: number): DayWorkout {
  return { type: "sorta_long", distanceKm, label: `${distanceKm.toFixed(1)} km` };
}

function longRun(distanceKm: number): DayWorkout {
  return { type: "long", distanceKm, label: `${distanceKm.toFixed(1)} km long run` };
}

// All Higdon miles converted to km (× 1.60934).
// Cameron's schedule: Wed / Sat / Sun — Mon/Tue/Thu/Fri are rest, no cross-training.
//
// Wed = original Higdon Wed (easy midweek run)
// Sat = original Higdon Sun (long run / race — moved to Saturday)
// Sun = original Higdon Tue/Thu (easy recovery run)
export const halfPlan: WeekPlan[] = [
  // Week 1 — Higdon Wed 3.2 / Sun 6.4 long / Tue+Thu 4.8
  { week: 1,  mon: rest, tue: rest, wed: easy(3.2),   thu: rest, fri: rest, sat: longRun(6.4),                                            sun: easy(4.8) },
  // Week 2 — same
  { week: 2,  mon: rest, tue: rest, wed: easy(3.2),   thu: rest, fri: rest, sat: longRun(6.4),                                            sun: easy(4.8) },
  // Week 3 — Higdon Wed 3.2 / Sun 8.0 long / Tue+Thu 5.6
  { week: 3,  mon: rest, tue: rest, wed: easy(3.2),   thu: rest, fri: rest, sat: longRun(8.0),                                            sun: easy(5.6) },
  // Week 4 — same
  { week: 4,  mon: rest, tue: rest, wed: easy(3.2),   thu: rest, fri: rest, sat: longRun(8.0),                                            sun: easy(5.6) },
  // Week 5 — Higdon Wed 3.2 / Sun 9.7 long / Tue+Thu 6.4
  { week: 5,  mon: rest, tue: rest, wed: easy(3.2),   thu: rest, fri: rest, sat: longRun(9.7),                                            sun: easy(6.4) },
  // Week 6 — Higdon Sun 5-K Race / Tue+Thu 6.4
  { week: 6,  mon: rest, tue: rest, wed: easy(3.2),   thu: rest, fri: rest, sat: { type: "race_5k",       distanceKm: 5.0,  label: "5-K Race"    }, sun: easy(6.4) },
  // Week 7 — Higdon Wed 4.8 / Sun 11.3 long / Tue+Thu 7.2
  { week: 7,  mon: rest, tue: rest, wed: easy(4.8),   thu: rest, fri: rest, sat: longRun(11.3),                                           sun: easy(7.2) },
  // Week 8 — Higdon Wed 4.8 / Sun 12.9 long / Tue+Thu 7.2
  { week: 8,  mon: rest, tue: rest, wed: easy(4.8),   thu: rest, fri: rest, sat: longRun(12.9),                                           sun: easy(7.2) },
  // Week 9 — Higdon Sun 10-K Race / Tue+Thu 8.0
  { week: 9,  mon: rest, tue: rest, wed: easy(4.8),   thu: rest, fri: rest, sat: { type: "race_10k",      distanceKm: 10.0, label: "10-K Race"   }, sun: easy(8.0) },
  // Week 10 — Higdon Wed 4.8 / Sun 14.5 long / Tue+Thu 8.0
  { week: 10, mon: rest, tue: rest, wed: easy(4.8),   thu: rest, fri: rest, sat: longRun(14.5),                                           sun: easy(8.0) },
  // Week 11 — Higdon Wed 4.8 / Sun 16.1 long / Tue+Thu 8.0
  { week: 11, mon: rest, tue: rest, wed: easy(4.8),   thu: rest, fri: rest, sat: longRun(16.1),                                           sun: easy(8.0) },
  // Week 12 — Higdon Sun Half Marathon / Tue 6.4 (taper easy after race)
  { week: 12, mon: rest, tue: rest, wed: easy(4.8),   thu: rest, fri: rest, sat: { type: "race_half",     distanceKm: 21.1, label: "Half Marathon" }, sun: easy(6.4) },
];

// Marathon Novice 1
// Wed = original Higdon Wed (sorta long run)
// Sat = original Higdon Sat long run; weeks 8+18 get the race moved from Sun → Sat
// Sun = original Higdon Tue easy run; week 18 = rest (post-marathon recovery)
export const marathonPlan: WeekPlan[] = [
  // Weeks 1–7: Tue 4.8 throughout
  { week: 1,  mon: rest, tue: rest, wed: sortaLong(4.8),  thu: rest, fri: rest, sat: longRun(9.7),                                             sun: easy(4.8) },
  { week: 2,  mon: rest, tue: rest, wed: sortaLong(4.8),  thu: rest, fri: rest, sat: longRun(11.3),                                            sun: easy(4.8) },
  { week: 3,  mon: rest, tue: rest, wed: sortaLong(6.4),  thu: rest, fri: rest, sat: longRun(8.0),                                             sun: easy(4.8) },
  { week: 4,  mon: rest, tue: rest, wed: sortaLong(6.4),  thu: rest, fri: rest, sat: longRun(14.5),                                            sun: easy(4.8) },
  { week: 5,  mon: rest, tue: rest, wed: sortaLong(8.0),  thu: rest, fri: rest, sat: longRun(16.1),                                            sun: easy(4.8) },
  { week: 6,  mon: rest, tue: rest, wed: sortaLong(8.0),  thu: rest, fri: rest, sat: longRun(11.3),                                            sun: easy(4.8) },
  { week: 7,  mon: rest, tue: rest, wed: sortaLong(9.7),  thu: rest, fri: rest, sat: longRun(19.3),                                            sun: easy(4.8) },
  // Week 8 — test half marathon moved from Sun → Sat; Sun = easy 4.8
  { week: 8,  mon: rest, tue: rest, wed: sortaLong(9.7),  thu: rest, fri: rest, sat: { type: "race_half",     distanceKm: 21.1, label: "Half Marathon (test)" }, sun: easy(4.8) },
  // Week 9 — Tue 4.8, Thu 6.4: use Tue (4.8)
  { week: 9,  mon: rest, tue: rest, wed: sortaLong(11.3), thu: rest, fri: rest, sat: longRun(16.1),                                            sun: easy(4.8) },
  { week: 10, mon: rest, tue: rest, wed: sortaLong(11.3), thu: rest, fri: rest, sat: longRun(24.1),                                            sun: easy(4.8) },
  // Week 11 — Tue 6.4
  { week: 11, mon: rest, tue: rest, wed: sortaLong(12.9), thu: rest, fri: rest, sat: longRun(25.7),                                            sun: easy(6.4) },
  { week: 12, mon: rest, tue: rest, wed: sortaLong(12.9), thu: rest, fri: rest, sat: longRun(19.3),                                            sun: easy(6.4) },
  { week: 13, mon: rest, tue: rest, wed: sortaLong(14.5), thu: rest, fri: rest, sat: longRun(29.0),                                            sun: easy(6.4) },
  // Week 14 — Tue 8.0
  { week: 14, mon: rest, tue: rest, wed: sortaLong(14.5), thu: rest, fri: rest, sat: longRun(22.5),                                            sun: easy(8.0) },
  { week: 15, mon: rest, tue: rest, wed: sortaLong(16.1), thu: rest, fri: rest, sat: longRun(32.2),                                            sun: easy(8.0) },
  { week: 16, mon: rest, tue: rest, wed: sortaLong(12.9), thu: rest, fri: rest, sat: longRun(19.3),                                            sun: easy(8.0) },
  // Week 17 — Tue 6.4
  { week: 17, mon: rest, tue: rest, wed: sortaLong(9.7),  thu: rest, fri: rest, sat: longRun(12.9),                                            sun: easy(6.4) },
  // Week 18 — marathon moved from Sun → Sat; Sun = rest (post-marathon recovery)
  { week: 18, mon: rest, tue: rest, wed: sortaLong(6.4),  thu: rest, fri: rest, sat: { type: "race_marathon", distanceKm: 42.2, label: "Marathon"             }, sun: rest },
];

export const plans: Record<PlanId, WeekPlan[]> = {
  half: halfPlan,
  marathon: marathonPlan,
};

export function getPlanInfo(planId: PlanId) {
  return planId === "half"
    ? { name: "Half Marathon Novice", weeks: 12, race: "Half Marathon" }
    : { name: "Marathon Novice 1", weeks: 18, race: "Marathon" };
}

export type DayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
export const DAY_KEYS: DayKey[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
export const DAY_LABELS: Record<DayKey, string> = {
  mon: "Mon",
  tue: "Tue",
  wed: "Wed",
  thu: "Thu",
  fri: "Fri",
  sat: "Sat",
  sun: "Sun",
};

export function getCurrentPlanWeek(
  planStartDate: Date,
  today: Date = new Date()
): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  const daysDiff = Math.floor((today.getTime() - planStartDate.getTime()) / msPerDay);
  if (daysDiff < 0) return 0;
  return Math.floor(daysDiff / 7) + 1;
}

export function getTodayWorkout(
  plan: WeekPlan[],
  planStartDate: Date,
  today: Date = new Date()
): { workout: DayWorkout; week: number; dayKey: DayKey } | null {
  const weekNum = getCurrentPlanWeek(planStartDate, today);
  if (weekNum < 1 || weekNum > plan.length) return null;
  const week = plan[weekNum - 1];
  const dayOfWeek = today.getDay(); // 0=Sun, 1=Mon...
  const keyMap: DayKey[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  const dayKey = keyMap[dayOfWeek];
  return { workout: week[dayKey], week: weekNum, dayKey };
}

export function getNextTrainingWorkout(
  plan: WeekPlan[],
  planStartDate: Date,
  today: Date = new Date()
): { workout: DayWorkout; dayLabel: string } | null {
  for (let i = 1; i <= 7; i++) {
    const next = new Date(today);
    next.setDate(today.getDate() + i);
    const result = getTodayWorkout(plan, planStartDate, next);
    if (result && result.workout.type !== "rest") {
      const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      return { workout: result.workout, dayLabel: dayNames[next.getDay()] };
    }
  }
  return null;
}

export function getWeeklyPlanKm(week: WeekPlan): number {
  return DAY_KEYS.reduce((sum, key) => {
    const day = week[key];
    return sum + (day.distanceKm ?? 0);
  }, 0);
}

export const WORKOUT_COLOURS: Record<WorkoutType, string> = {
  rest: "#374151",
  easy: "#f97316",
  long: "#ef4444",
  cross: "#3b82f6",
  race_5k: "#a855f7",
  race_10k: "#a855f7",
  race_half: "#ec4899",
  race_marathon: "#fbbf24",
  sorta_long: "#f59e0b",
};

export const WORKOUT_BADGE: Record<WorkoutType, string> = {
  rest: "bg-gray-800 text-gray-400",
  easy: "bg-orange-950 text-orange-400",
  long: "bg-red-950 text-red-400",
  cross: "bg-blue-950 text-blue-400",
  race_5k: "bg-purple-950 text-purple-400",
  race_10k: "bg-purple-950 text-purple-400",
  race_half: "bg-pink-950 text-pink-400",
  race_marathon: "bg-yellow-950 text-yellow-400",
  sorta_long: "bg-amber-950 text-amber-400",
};
