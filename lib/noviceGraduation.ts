import type { PlanConfig, TrainingWeek } from "@/data/trainingPlan";
import type { NoviceHandoffData, NoviceWeeklyEvaluation } from "@/types/novice";

export function suggestNextGoal(completedGoal: PlanConfig["goal"]): "5k" | "10k" | "half" {
  if (completedGoal === "5k") return "10k";
  if (completedGoal === "10k") return "half";
  return "5k";
}

export function bestLongRunKmInWeeks(weeks: TrainingWeek[]): number {
  let best = 0;
  for (const w of weeks) {
    for (const s of w.sessions) {
      if (s.type === "long" && s.targetDistanceKm > best) best = s.targetDistanceKm;
    }
  }
  return Math.round(best * 10) / 10;
}

export function evaluateNoviceGraduation(input: {
  userId: string;
  config: PlanConfig;
  planWeeks: TrainingWeek[];
  planStatus: string;
  finalWeekEvaluation: Pick<NoviceWeeklyEvaluation, "weekNumber" | "completionRate" | "hasInjuryFlag"> | null;
  bestLongRunKmLastFourWeeks: number;
  totalSessionsCompleted: number;
  totalKmCovered: number;
  peakWeeklyKm: number;
  averageWeeklyRpe: number;
  estimatedPaceSecPerKm: number | null;
}): { eligible: boolean; reason: string; handoffData: NoviceHandoffData | null } {
  const {
    userId,
    config,
    planWeeks,
    planStatus,
    finalWeekEvaluation,
    bestLongRunKmLastFourWeeks,
    totalSessionsCompleted,
    totalKmCovered,
    peakWeeklyKm,
    averageWeeklyRpe,
    estimatedPaceSecPerKm,
  } = input;

  const lastWeek = planWeeks[planWeeks.length - 1];
  if (!lastWeek || !finalWeekEvaluation) {
    return { eligible: false, reason: "Program not finished yet.", handoffData: null };
  }

  const reachedEnd = finalWeekEvaluation.weekNumber === lastWeek.week;
  if (!reachedEnd) {
    return { eligible: false, reason: "Complete your final week first.", handoffData: null };
  }

  if (planStatus === "PAUSED_INJURY") {
    return { eligible: false, reason: "Plan is paused for injury.", handoffData: null };
  }

  if (finalWeekEvaluation.hasInjuryFlag) {
    return { eligible: false, reason: "Injury was reported in the final week.", handoffData: null };
  }

  if (finalWeekEvaluation.completionRate < 0.67) {
    return { eligible: false, reason: "Final week completion was below the graduation threshold.", handoffData: null };
  }

  const minLong =
    config.goal === "5k" ? 4 : config.goal === "10k" ? 7 : 4;
  if (bestLongRunKmLastFourWeeks < minLong) {
    return {
      eligible: false,
      reason: `Build a bit more endurance — aim for at least one long run of ${minLong} km in your last few weeks.`,
      handoffData: null,
    };
  }

  if (config.goal !== "5k" && config.goal !== "10k") {
    return { eligible: false, reason: "Graduation is only defined for Novice 5K/10K programs.", handoffData: null };
  }

  const handoffData: NoviceHandoffData = {
    userId,
    completedGoal: config.goal,
    programWeeks: config.weeks,
    totalSessionsCompleted,
    totalKmCovered: Math.round(totalKmCovered * 10) / 10,
    estimatedPaceSecPerKm,
    peakWeeklyKm: Math.round(peakWeeklyKm * 10) / 10,
    averageWeeklyRpe: Math.round(averageWeeklyRpe * 10) / 10,
    suggestedNextLevel: "BEGINNER",
    suggestedNextGoal: suggestNextGoal(config.goal),
    graduatedAt: new Date().toISOString(),
  };

  return {
    eligible: true,
    reason: "Congratulations — you are ready for the Beginner program.",
    handoffData,
  };
}
