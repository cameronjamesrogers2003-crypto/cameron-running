import type { PlanConfig } from "@/data/trainingPlan";

/** Duration-aware weekly km ceiling for Novice 5K/10K (build-week target cap). */
export function getNovicePeakWeeklyKm(goal: PlanConfig["goal"], weeks: PlanConfig["weeks"]): number {
  if (goal === "5k") {
    switch (weeks) {
      case 8:
        return 15;
      case 12:
        return 17;
      case 16:
        return 19;
      case 20:
        return 21;
    }
  }
  if (goal === "10k") {
    switch (weeks) {
      case 8:
        return 22;
      case 12:
        return 27;
      case 16:
        return 31;
      case 20:
        return 35;
    }
  }
  return 30;
}

/** First N build weeks use run/walk ratio on sessions; N ≈ 60% of non-taper weeks (rounded). */
export function getNoviceRunWalkTransitionWeek(weeks: PlanConfig["weeks"]): number {
  const taperWeeks = weeks === 8 ? 1 : 2;
  const buildWeeks = weeks - taperWeeks;
  return Math.round(buildWeeks * 0.6);
}
