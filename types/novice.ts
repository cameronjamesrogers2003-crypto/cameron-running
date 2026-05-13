import type { RunType } from "@/data/trainingPlan";

export type NoviceCheckinSessionType = Extract<RunType, "easy" | "long" | "tempo">;

export type NoviceSkipReason = "illness" | "injury" | "time" | "motivation" | "other";

export interface NoviceSessionCheckin {
  sessionId: string;
  weekNumber: number;
  sessionType: NoviceCheckinSessionType;
  plannedDistanceKm: number;
  plannedDurationMin: number;

  stravaActivityId: string | null;
  actualDistanceKm: number | null;
  actualDurationMin: number | null;
  averagePaceSecPerKm: number | null;
  averageHeartRate: number | null;
  maxHeartRate: number | null;
  perceivedEffortFromHr: number | null;

  completed: boolean;
  userRpe: number;
  skippedReason: NoviceSkipReason | null;

  distanceCompletionRatio: number | null;
  effortScore: number | null;
  createdAt: string;
}

export type NoviceAdaptiveDecision =
  | "PROGRESS"
  | "REPEAT_WEEK"
  | "REDUCE_LOAD"
  | "PAUSE_INJURY"
  | "ACCELERATE";

export interface NoviceWeeklyEvaluation {
  userId: string;
  planId: string;
  weekNumber: number;

  totalSessionsPlanned: number;
  totalSessionsCompleted: number;
  completionRate: number;

  totalPlannedKm: number;
  totalActualKm: number | null;
  volumeCompletionRatio: number | null;

  averageUserRpe: number;
  averageEffortScore: number | null;

  sessionsMissed: number;
  missedReasons: (NoviceSkipReason | null)[];
  hasInjuryFlag: boolean;
  hasIllnessFlag: boolean;

  adaptiveDecision: NoviceAdaptiveDecision;
  decisionReason: string;

  evaluatedAt: string;
}

export interface WeekSnapshot {
  weekNumber: number;
  totalKm: number;
  sessions: {
    type: NoviceCheckinSessionType;
    distanceKm: number;
    runWalkRatio?: { runSec: number; walkSec: number };
  }[];
}

export interface NovicePlanMutation {
  planId: string;
  triggeredByEvaluation: string;
  weekNumber: number;
  mutationType: NoviceAdaptiveDecision;
  originalWeekData: WeekSnapshot;
  mutatedWeekData: WeekSnapshot;
  createdAt: string;
}

export interface NoviceHandoffData {
  userId: string;
  completedGoal: "5k" | "10k";
  programWeeks: number;
  totalSessionsCompleted: number;
  totalKmCovered: number;
  estimatedPaceSecPerKm: number | null;
  peakWeeklyKm: number;
  averageWeeklyRpe: number;
  suggestedNextLevel: "BEGINNER";
  suggestedNextGoal: "5k" | "10k" | "half";
  graduatedAt: string;
}
