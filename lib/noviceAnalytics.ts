import type { PlanConfig, TrainingWeek } from "@/data/trainingPlan";
import { roundProgramDistanceKm } from "@/lib/planDistanceKm";

export type AnalyticsCheckin = {
  sessionId: string;
  weekNumber: number;
  sessionType: string;
  plannedDistanceKm: number;
  actualDistanceKm: number | null;
  completed: boolean;
  userRpe: number;
  skippedReason: string | null;
  effortScore: number | null;
  createdAt: Date;
};

export type AnalyticsEvaluation = {
  id: string;
  weekNumber: number;
  completionRate: number;
  adaptiveDecision: string;
  decisionReason: string;
  totalPlannedKm: number;
  totalActualKm: number | null;
  averageUserRpe: number;
  hasInjuryFlag: boolean;
  sessionsMissed: number;
  totalSessionsPlanned: number;
  totalSessionsCompleted: number;
  evaluatedAt: Date;
};

export type AnalyticsMutation = {
  weekNumber: number;
  mutationType: string;
};

export function sessionDisplayType(type: string): string {
  return type === "tempo" ? "Bridge Run" : type === "long" ? "Long Run" : "Easy Run";
}

export function computeCurrentAndBestStreak(checkins: AnalyticsCheckin[]): { currentStreak: number; bestStreak: number } {
  const sorted = checkins
    .slice()
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  let best = 0;
  let run = 0;
  for (const c of sorted) {
    if (c.completed) {
      run += 1;
      best = Math.max(best, run);
    } else {
      run = 0;
    }
  }
  return { currentStreak: run, bestStreak: best };
}

export function computeLongestRunKm(
  goal: PlanConfig["goal"],
  checkins: AnalyticsCheckin[],
  plan: TrainingWeek[],
  completedWeeks: Set<number>,
): number | null {
  let longestActual: number | null = null;
  for (const c of checkins) {
    if (c.sessionType !== "long" || !c.completed) continue;
    const km = c.actualDistanceKm ?? c.plannedDistanceKm;
    longestActual = longestActual == null ? km : Math.max(longestActual, km);
  }
  if (longestActual != null) return longestActual;

  let fallback: number | null = null;
  for (const w of plan) {
    if (!completedWeeks.has(w.week)) continue;
    for (const s of w.sessions) {
      if (s.type === "long") {
        fallback = fallback == null ? s.targetDistanceKm : Math.max(fallback, s.targetDistanceKm);
      }
    }
  }
  return fallback;
}

export function computeWeekInsight(params: {
  completionRate: number;
  averageRpe: number | null;
  sessionsCompleted: number;
  sessionsPlanned: number;
  hasInjuryFlag: boolean;
  hasAnyData: boolean;
}): string {
  const { completionRate, averageRpe, sessionsCompleted, sessionsPlanned, hasInjuryFlag, hasAnyData } = params;

  if (hasInjuryFlag) return "Plan paused this week due to injury.";
  if (!hasAnyData) return "No session data for this week yet.";

  if (completionRate >= 0.999) {
    if (averageRpe != null && averageRpe <= 4) return "Strong week. You made it look easy.";
    if (averageRpe != null && averageRpe <= 7) return "Solid week. Good consistent effort.";
    return "Tough week, but you got through it. Recovery is part of the process.";
  }

  if (completionRate >= 0.5) {
    return `Partial week — you got ${sessionsCompleted} of ${sessionsPlanned} sessions done.`;
  }

  return "Difficult week. The plan has adjusted to keep you on track.";
}

export function computeRpeTrendSlope(points: { x: number; y: number }[]): number {
  if (points.length < 2) return 0;
  const n = points.length;
  const sumX = points.reduce((a, p) => a + p.x, 0);
  const sumY = points.reduce((a, p) => a + p.y, 0);
  const sumXY = points.reduce((a, p) => a + p.x * p.y, 0);
  const sumXX = points.reduce((a, p) => a + p.x * p.x, 0);
  const denom = n * sumXX - sumX * sumX;
  if (denom === 0) return 0;
  return (n * sumXY - sumX * sumY) / denom;
}

export function plannedWeekKm(week: TrainingWeek): number {
  const sum = week.sessions.reduce((s, sess) => s + sess.targetDistanceKm, 0);
  return roundProgramDistanceKm(sum);
}

export function getRunWalkForWeek(week: TrainingWeek): { runSec: number; walkSec: number; isContinuous: boolean } {
  const withRatio = week.sessions.find((s) => s.structure?.runWalkRatio);
  if (!withRatio?.structure?.runWalkRatio) {
    return { runSec: 60, walkSec: 0, isContinuous: true };
  }
  const rw = withRatio.structure.runWalkRatio;
  return { runSec: rw.runSec, walkSec: rw.walkSec, isContinuous: rw.walkSec === 0 };
}

export function isCutbackWeek(week: TrainingWeek): boolean {
  return Boolean(week.isRecovery) || /cutback/i.test(week.phase);
}

export function summarizeWeeklyActualKm(
  week: TrainingWeek,
  weekCheckins: AnalyticsCheckin[],
): { actualKm: number | null; hasStrava: boolean } {
  let anyActual = false;
  let total = 0;
  for (const s of week.sessions) {
    const c = weekCheckins.find((row) => row.sessionId === s.id);
    if (!c) continue;
    if (c.actualDistanceKm != null) {
      anyActual = true;
      total += c.actualDistanceKm;
    } else if (c.completed) {
      total += c.plannedDistanceKm;
    }
  }
  return { actualKm: weekCheckins.length ? Number(total.toFixed(1)) : null, hasStrava: anyActual };
}

export function decisionLabel(decision: string | null): string {
  if (!decision) return "On track";
  if (decision === "PROGRESS") return "On track";
  if (decision === "REPEAT_WEEK") return "Week repeated";
  if (decision === "REDUCE_LOAD") return "Load reduced";
  if (decision === "PAUSE_INJURY") return "Plan paused";
  if (decision === "ACCELERATE") return "Moved forward";
  return decision;
}

export function goalDistanceKm(goal: PlanConfig["goal"]): number {
  return goal === "10k" ? 10 : 5;
}
