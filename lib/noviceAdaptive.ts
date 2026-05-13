import type { PlanConfig, TrainingWeek, Session } from "@/data/trainingPlan";
import type { GeneratedPlanBundle, NovicePlanRuntimeState } from "@/types/generatedPlan";
import { defaultNoviceRuntimeState } from "@/types/generatedPlan";
import type {
  NoviceAdaptiveDecision,
  NovicePlanMutation,
  NoviceSessionCheckin,
  NoviceWeeklyEvaluation,
  WeekSnapshot,
} from "@/types/novice";

export const MAX_REPEAT_WEEKS = 2;

export const MAX_PLAN_EXTENSION_WEEKS = 4;

function r1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function computeEffortScore(userRpe: number, perceivedEffortFromHr: number | null): number {
  if (perceivedEffortFromHr === null || !Number.isFinite(perceivedEffortFromHr)) return userRpe;
  return r1(userRpe * 0.65 + perceivedEffortFromHr * 0.35);
}

function getRepeatCount(state: NovicePlanRuntimeState | undefined, weekNumber: number): number {
  if (!state) return 0;
  const k = String(weekNumber);
  const v = state.weekRepeatCounts[k];
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

function pushDecision(state: NovicePlanRuntimeState, weekNumber: number, decision: NoviceAdaptiveDecision): void {
  state.recentDecisions = [...state.recentDecisions, { weekNumber, decision }].slice(-3);
}

function hadAccelerateInLastTwo(state: NovicePlanRuntimeState | undefined): boolean {
  if (!state?.recentDecisions.length) return false;
  const last = state.recentDecisions.slice(-2);
  return last.some((d) => d.decision === "ACCELERATE");
}

export function buildEvaluationInputFromCheckins(params: {
  userId: string;
  planId: string;
  weekNumber: number;
  checkins: NoviceSessionCheckin[];
  planWeek: TrainingWeek;
}): Omit<NoviceWeeklyEvaluation, "adaptiveDecision" | "decisionReason"> {
  const { userId, planId, weekNumber, checkins, planWeek } = params;
  const plannedSessions = planWeek.sessions.filter(
    (s) => s.type === "easy" || s.type === "long" || s.type === "tempo",
  );
  const totalSessionsPlanned = plannedSessions.length;
  const totalPlannedKm = r1(plannedSessions.reduce((a, s) => a + s.targetDistanceKm, 0));

  const completed = checkins.filter((c) => c.completed);
  const totalSessionsCompleted = completed.length;
  const completionRate =
    totalSessionsPlanned > 0 ? totalSessionsCompleted / totalSessionsPlanned : 0;

  let totalActualKm: number | null = null;
  const actuals = checkins
    .map((c) => c.actualDistanceKm)
    .filter((x): x is number => x != null && Number.isFinite(x));
  if (actuals.length > 0) {
    totalActualKm = r1(actuals.reduce((a, b) => a + b, 0));
  }

  const volumeCompletionRatio =
    totalActualKm != null && totalPlannedKm > 0 ? r1(totalActualKm / totalPlannedKm) : null;

  const rpes = completed.map((c) => c.userRpe).filter((x) => Number.isFinite(x));
  const averageUserRpe =
    rpes.length > 0 ? r1(rpes.reduce((a, b) => a + b, 0) / rpes.length) : 0;

  const efforts = completed
    .map((c) => c.effortScore)
    .filter((x): x is number => x != null && Number.isFinite(x));
  const averageEffortScore =
    efforts.length > 0 ? r1(efforts.reduce((a, b) => a + b, 0) / efforts.length) : null;

  const missed = checkins.filter((c) => !c.completed);
  const sessionsMissed = missed.length;
  const missedReasons = missed.map((c) => c.skippedReason ?? null);
  const hasInjuryFlag = missed.some((c) => c.skippedReason === "injury");
  const hasIllnessFlag = missed.some((c) => c.skippedReason === "illness");

  return {
    userId,
    planId,
    weekNumber,
    totalSessionsPlanned,
    totalSessionsCompleted,
    completionRate,
    totalPlannedKm,
    totalActualKm,
    volumeCompletionRatio,
    averageUserRpe,
    averageEffortScore,
    sessionsMissed,
    missedReasons,
    hasInjuryFlag,
    hasIllnessFlag,
    evaluatedAt: new Date().toISOString(),
  };
}

export function evaluateNoviceWeek(
  evaluation: Omit<NoviceWeeklyEvaluation, "adaptiveDecision" | "decisionReason">,
  config: PlanConfig,
  currentWeekNumber: number,
  ctx: { noviceRuntime?: NovicePlanRuntimeState },
): { decision: NoviceAdaptiveDecision; reason: string } {
  const rt = ctx.noviceRuntime ?? defaultNoviceRuntimeState();
  const repeatCount = getRepeatCount(rt, currentWeekNumber);

  const wouldRepeat = (reason: string): { decision: NoviceAdaptiveDecision; reason: string } => {
    if (repeatCount >= MAX_REPEAT_WEEKS) {
      return {
        decision: "REDUCE_LOAD",
        reason:
          "You've repeated this week twice already. We'll move you forward with a reduced workload — listen to your body and do what you can.",
      };
    }
    return { decision: "REPEAT_WEEK", reason };
  };

  if (evaluation.hasInjuryFlag) {
    return {
      decision: "PAUSE_INJURY",
      reason:
        "You reported an injury this week. Your plan has been paused. Please rest and seek advice before continuing.",
    };
  }

  if (evaluation.completionRate === 0) {
    return wouldRepeat(
      "No sessions were completed this week. We'll repeat this week so you don't lose your progress.",
    );
  }

  let strugglingSignals = 0;
  if (evaluation.averageUserRpe >= 8) strugglingSignals++;
  if (evaluation.averageEffortScore != null && evaluation.averageEffortScore >= 7.5) strugglingSignals++;
  if (evaluation.volumeCompletionRatio != null && evaluation.volumeCompletionRatio < 0.7) strugglingSignals++;
  if (evaluation.completionRate < 0.67) strugglingSignals++;

  if (strugglingSignals >= 2) {
    if (evaluation.completionRate < 0.5) {
      return wouldRepeat(
        "This week felt very tough and you completed less than half your sessions. Repeating this week will build your confidence before moving forward.",
      );
    }
    return {
      decision: "REDUCE_LOAD",
      reason:
        "This week felt harder than expected. Next week's volume has been reduced slightly to help you recover and adapt.",
    };
  }

  if (evaluation.completionRate < 0.67 && !evaluation.hasIllnessFlag) {
    return wouldRepeat(
      "You missed more than one session this week. Repeating the week will make sure you're ready to progress.",
    );
  }
  if (evaluation.hasIllnessFlag && evaluation.completionRate < 0.67) {
    return wouldRepeat(
      "You were unwell this week. Repeating the week is the safest way to get back on track.",
    );
  }

  let decision: NoviceAdaptiveDecision = "PROGRESS";
  let reason = "Great work this week. You're on track — keep it up.";

  const withinThreeWeeksOfEnd = currentWeekNumber >= config.weeks - 2;
  const volOk =
    evaluation.volumeCompletionRatio == null || evaluation.volumeCompletionRatio >= 0.95;
  const effortOk =
    evaluation.averageEffortScore == null || evaluation.averageEffortScore <= 4.5;
  if (
    decision === "PROGRESS" &&
    evaluation.completionRate === 1.0 &&
    evaluation.averageUserRpe <= 4 &&
    effortOk &&
    volOk &&
    !withinThreeWeeksOfEnd &&
    !hadAccelerateInLastTwo(rt)
  ) {
    decision = "ACCELERATE";
    reason =
      "You smashed this week. You're adapting faster than expected — we've bumped you forward.";
  }

  return { decision, reason };
}

export function weekToSnapshot(week: TrainingWeek): WeekSnapshot {
  const sessions = week.sessions
    .filter((s) => s.type === "easy" || s.type === "long" || s.type === "tempo")
    .map((s) => ({
      type: s.type as WeekSnapshot["sessions"][number]["type"],
      distanceKm: s.targetDistanceKm,
      runWalkRatio: s.structure?.runWalkRatio,
    }));
  const totalKm = r1(sessions.reduce((a, s) => a + s.distanceKm, 0));
  return { weekNumber: week.week, totalKm, sessions };
}

function cloneSession(s: Session, weekNum: number): Session {
  const day = s.day;
  return {
    ...s,
    id: `${weekNum}-${day}`,
  };
}

function cloneWeek(week: TrainingWeek, newWeekNumber: number): TrainingWeek {
  return {
    ...week,
    week: newWeekNumber,
    sessions: week.sessions.map((s) => cloneSession(s, newWeekNumber)),
  };
}

function renumberWeeks(weeks: TrainingWeek[]): TrainingWeek[] {
  return weeks.map((w, i) => {
    const n = i + 1;
    if (w.week === n) return w;
    return {
      ...w,
      week: n,
      sessions: w.sessions.map((s) => cloneSession(s, n)),
    };
  });
}

function scaleWeekSessions(week: TrainingWeek, factor: number): TrainingWeek {
  return {
    ...week,
    sessions: week.sessions.map((s) => {
      const scaled: Session = {
        ...s,
        targetDistanceKm: r1(s.targetDistanceKm * factor),
      };
      if (scaled.structure?.runWalkRatio) {
        const { runSec, walkSec } = scaled.structure.runWalkRatio;
        scaled.structure = {
          ...scaled.structure,
          runWalkRatio: {
            runSec: Math.max(1, Math.round(runSec * factor)),
            walkSec: Math.max(0, Math.round(walkSec * factor)),
          },
        };
      }
      return scaled;
    }),
  };
}

export function applyNoviceAdaptiveDecision(
  bundle: GeneratedPlanBundle,
  decision: NoviceAdaptiveDecision,
  currentWeekNumber: number,
  config: PlanConfig,
  evaluationId: string,
  planId: string,
): { bundle: GeneratedPlanBundle; mutations: NovicePlanMutation[] } {
  const mutations: NovicePlanMutation[] = [];
  const weeks = bundle.weeks.map((w) => ({ ...w, sessions: w.sessions.map((s) => ({ ...s })) }));
  const noviceRuntime: NovicePlanRuntimeState = {
    ...(bundle.noviceRuntime ?? defaultNoviceRuntimeState()),
    weekRepeatCounts: { ...(bundle.noviceRuntime?.weekRepeatCounts ?? {}) },
    recentDecisions: [...(bundle.noviceRuntime?.recentDecisions ?? [])],
    pausedAt: bundle.noviceRuntime?.pausedAt ?? null,
  };

  const now = new Date().toISOString();
  const idx = currentWeekNumber - 1;
  const nextIdx = currentWeekNumber;

  const recordMutation = (
    weekNum: number,
    orig: WeekSnapshot,
    mut: WeekSnapshot,
    mutationType: NoviceAdaptiveDecision = decision,
  ) => {
    mutations.push({
      planId,
      triggeredByEvaluation: evaluationId,
      weekNumber: weekNum,
      mutationType,
      originalWeekData: orig,
      mutatedWeekData: mut,
      createdAt: now,
    });
  };

  if (decision === "PROGRESS") {
    pushDecision(noviceRuntime, currentWeekNumber, decision);
    return { bundle: { weeks, noviceRuntime }, mutations };
  }

  if (decision === "PAUSE_INJURY") {
    noviceRuntime.planStatus = "PAUSED_INJURY";
    noviceRuntime.pausedAt = now;
    pushDecision(noviceRuntime, currentWeekNumber, decision);
    const snap = idx >= 0 && idx < weeks.length ? weekToSnapshot(weeks[idx]) : weekToSnapshot(weeks[0]);
    recordMutation(currentWeekNumber, snap, snap, "PAUSE_INJURY");
    return { bundle: { weeks, noviceRuntime }, mutations };
  }

  if (decision === "REDUCE_LOAD") {
    if (nextIdx >= 0 && nextIdx < weeks.length) {
      const before = weekToSnapshot(weeks[nextIdx]);
      weeks[nextIdx] = scaleWeekSessions(weeks[nextIdx], 0.8);
      const after = weekToSnapshot(weeks[nextIdx]);
      recordMutation(currentWeekNumber + 1, before, after, "REDUCE_LOAD");
    }
    pushDecision(noviceRuntime, currentWeekNumber, decision);
    return { bundle: { weeks, noviceRuntime }, mutations };
  }

  if (decision === "REPEAT_WEEK") {
    if (weeks.length >= config.weeks + MAX_PLAN_EXTENSION_WEEKS) {
      return applyNoviceAdaptiveDecision(
        { weeks, noviceRuntime },
        "REDUCE_LOAD",
        currentWeekNumber,
        config,
        evaluationId,
        planId,
      );
    }
    if (idx < 0 || idx >= weeks.length) {
      pushDecision(noviceRuntime, currentWeekNumber, "REDUCE_LOAD");
      return { bundle: { weeks, noviceRuntime }, mutations };
    }
    const dup = cloneWeek(weeks[idx], weeks[idx].week);
    const beforeAll = weekToSnapshot(weeks[idx]);
    weeks.splice(idx + 1, 0, dup);
    const renumbered = renumberWeeks(weeks);
    weeks.length = 0;
    weeks.push(...renumbered);
    const k = String(currentWeekNumber);
    noviceRuntime.weekRepeatCounts[k] = (noviceRuntime.weekRepeatCounts[k] ?? 0) + 1;
    pushDecision(noviceRuntime, currentWeekNumber, "REPEAT_WEEK");
    const afterSnap = idx + 1 < weeks.length ? weekToSnapshot(weeks[idx + 1]) : beforeAll;
    recordMutation(currentWeekNumber + 1, beforeAll, afterSnap, "REPEAT_WEEK");
    return { bundle: { weeks, noviceRuntime }, mutations };
  }

  if (decision === "ACCELERATE") {
    if (nextIdx >= 0 && nextIdx < weeks.length) {
      const removed = weeks[nextIdx];
      const origSnap = weekToSnapshot(removed);
      weeks.splice(nextIdx, 1);
      const renumbered = renumberWeeks(weeks);
      weeks.length = 0;
      weeks.push(...renumbered);
      const mutSnap =
        nextIdx < renumbered.length ? weekToSnapshot(renumbered[Math.min(nextIdx, renumbered.length - 1)]) : origSnap;
      recordMutation(currentWeekNumber + 1, origSnap, mutSnap, "ACCELERATE");
    }
    pushDecision(noviceRuntime, currentWeekNumber, "ACCELERATE");
    return { bundle: { weeks, noviceRuntime }, mutations };
  }

  return { bundle: { weeks, noviceRuntime }, mutations };
}

export function perceivedEffortFromHeartRate(avgHr: number, ageYears: number): number {
  const maxHr = Math.max(120, 220 - ageYears);
  return r1((avgHr / maxHr) * 10);
}

export function enrichNoviceCheckin(
  input: Omit<NoviceSessionCheckin, "distanceCompletionRatio" | "effortScore" | "createdAt"> & {
    createdAt?: string;
  },
  ageYears: number | null,
): NoviceSessionCheckin {
  let perceivedEffortFromHr = input.perceivedEffortFromHr;
  if (
    perceivedEffortFromHr == null &&
    input.averageHeartRate != null &&
    ageYears != null &&
    Number.isFinite(ageYears)
  ) {
    perceivedEffortFromHr = perceivedEffortFromHeartRate(input.averageHeartRate, ageYears);
  }

  const distanceCompletionRatio =
    input.actualDistanceKm != null && input.plannedDistanceKm > 0
      ? r1(input.actualDistanceKm / input.plannedDistanceKm)
      : null;

  const effortScore =
    input.completed ? computeEffortScore(input.userRpe, perceivedEffortFromHr) : null;

  return {
    ...input,
    perceivedEffortFromHr,
    distanceCompletionRatio,
    effortScore,
    createdAt: input.createdAt ?? new Date().toISOString(),
  };
}
