import type { TrainingWeek } from "@/data/trainingPlan";

export type NovicePlanStatus = "ACTIVE" | "PAUSED_INJURY" | "COMPLETED" | "GRADUATED";

export interface NovicePlanRuntimeState {
  planStatus: NovicePlanStatus;
  weekRepeatCounts: Record<string, number>;
  recentDecisions: { weekNumber: number; decision: string }[];
  pausedAt: string | null;
}

export interface GeneratedPlanBundle {
  weeks: TrainingWeek[];
  noviceRuntime?: NovicePlanRuntimeState;
}

export function defaultNoviceRuntimeState(): NovicePlanRuntimeState {
  return {
    planStatus: "ACTIVE",
    weekRepeatCounts: {},
    recentDecisions: [],
    pausedAt: null,
  };
}
