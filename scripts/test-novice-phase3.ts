/**
 * Phase 3 unit checks: Novice adaptive evaluation, mutations, graduation.
 * Run: cd /workspace && npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/test-novice-phase3.ts
 */
import type { PlanConfig, TrainingWeek } from "../data/trainingPlan";
import {
  applyNoviceAdaptiveDecision,
  buildEvaluationInputFromCheckins,
  computeEffortScore,
  evaluateNoviceWeek,
} from "../lib/noviceAdaptive";
import { evaluateNoviceGraduation, suggestNextGoal } from "../lib/noviceGraduation";
import { defaultNoviceRuntimeState } from "../types/generatedPlan";
import type { NoviceSessionCheckin } from "../types/novice";

function assert(name: string, cond: boolean, detail?: string) {
  if (!cond) {
    console.error(`FAIL: ${name}${detail ? ` — ${detail}` : ""}`);
    process.exitCode = 1;
  } else {
    console.log(`ok: ${name}`);
  }
}

const baseCfg: PlanConfig = {
  level: "NOVICE",
  goal: "5k",
  weeks: 12,
  days: ["tue", "thu", "sat"],
  longRunDay: "sat",
  vdot: 28,
};

function mkCheckin(p: Partial<NoviceSessionCheckin> & Pick<NoviceSessionCheckin, "weekNumber" | "completed" | "userRpe">): NoviceSessionCheckin {
  return {
    sessionId: p.sessionId ?? "s1",
    weekNumber: p.weekNumber,
    sessionType: p.sessionType ?? "easy",
    plannedDistanceKm: p.plannedDistanceKm ?? 3,
    plannedDurationMin: p.plannedDurationMin ?? 30,
    stravaActivityId: p.stravaActivityId ?? null,
    actualDistanceKm: p.actualDistanceKm ?? null,
    actualDurationMin: p.actualDurationMin ?? null,
    averagePaceSecPerKm: p.averagePaceSecPerKm ?? null,
    averageHeartRate: p.averageHeartRate ?? null,
    maxHeartRate: p.maxHeartRate ?? null,
    perceivedEffortFromHr: p.perceivedEffortFromHr ?? null,
    completed: p.completed,
    userRpe: p.userRpe,
    skippedReason: p.skippedReason ?? null,
    distanceCompletionRatio: p.distanceCompletionRatio ?? null,
    effortScore: p.effortScore ?? null,
    createdAt: p.createdAt ?? new Date().toISOString(),
  };
}

// computeEffortScore
assert("effort blend", computeEffortScore(4, 6) === 4.7);

// Injury → PAUSE
{
  const planWeek: TrainingWeek = {
    week: 1,
    phase: "Beginner Base",
    isCutback: false,
    sessions: [
      { id: "1-tue", day: "tue", type: "easy", targetDistanceKm: 2, targetPaceMinPerKm: 7, description: "" },
      { id: "1-thu", day: "thu", type: "easy", targetDistanceKm: 2, targetPaceMinPerKm: 7, description: "" },
      { id: "1-sat", day: "sat", type: "long", targetDistanceKm: 3, targetPaceMinPerKm: 7, description: "" },
    ],
  };
  const checkins = [
    mkCheckin({ weekNumber: 1, completed: false, userRpe: 5, skippedReason: "injury" }),
    mkCheckin({ weekNumber: 1, completed: true, userRpe: 3, sessionId: "s2" }),
  ];
  const input = buildEvaluationInputFromCheckins({
    userId: "1",
    planId: "singleton",
    weekNumber: 1,
    checkins,
    planWeek,
  });
  const r = evaluateNoviceWeek(input, baseCfg, 1, {});
  assert("injury pause", r.decision === "PAUSE_INJURY");
}

// Zero completion → REPEAT
{
  const planWeek: TrainingWeek = {
    week: 1,
    phase: "Beginner Base",
    isCutback: false,
    sessions: [
      { id: "1-tue", day: "tue", type: "easy", targetDistanceKm: 2, targetPaceMinPerKm: 7, description: "" },
      { id: "1-sat", day: "sat", type: "long", targetDistanceKm: 3, targetPaceMinPerKm: 7, description: "" },
    ],
  };
  const checkins = [
    mkCheckin({ weekNumber: 1, completed: false, userRpe: 5, skippedReason: "time", sessionId: "a" }),
    mkCheckin({ weekNumber: 1, completed: false, userRpe: 5, skippedReason: "time", sessionId: "b" }),
  ];
  const input = buildEvaluationInputFromCheckins({
    userId: "1",
    planId: "singleton",
    weekNumber: 1,
    checkins,
    planWeek,
  });
  const r = evaluateNoviceWeek(input, baseCfg, 1, {});
  assert("zero completion repeat", r.decision === "REPEAT_WEEK");
}

// RPE≥8 + completion <50% → REPEAT
{
  const planWeek: TrainingWeek = {
    week: 2,
    phase: "Beginner Base",
    isCutback: false,
    sessions: [
      { id: "2-tue", day: "tue", type: "easy", targetDistanceKm: 2, targetPaceMinPerKm: 7, description: "" },
      { id: "2-thu", day: "thu", type: "easy", targetDistanceKm: 2, targetPaceMinPerKm: 7, description: "" },
      { id: "2-sat", day: "sat", type: "long", targetDistanceKm: 3, targetPaceMinPerKm: 7, description: "" },
    ],
  };
  const checkins = [
    mkCheckin({ weekNumber: 2, completed: true, userRpe: 9, sessionId: "a" }),
    mkCheckin({ weekNumber: 2, completed: false, userRpe: 9, skippedReason: "time", sessionId: "b" }),
    mkCheckin({ weekNumber: 2, completed: false, userRpe: 9, skippedReason: "time", sessionId: "c" }),
  ];
  const input = buildEvaluationInputFromCheckins({
    userId: "1",
    planId: "singleton",
    weekNumber: 2,
    checkins,
    planWeek,
  });
  const r = evaluateNoviceWeek(input, baseCfg, 2, {});
  assert("struggle low completion repeat", r.decision === "REPEAT_WEEK");
}

// RPE≥8 + completion 50–66% → REDUCE_LOAD
{
  const planWeek: TrainingWeek = {
    week: 2,
    phase: "Beginner Base",
    isCutback: false,
    sessions: [
      { id: "2-tue", day: "tue", type: "easy", targetDistanceKm: 2, targetPaceMinPerKm: 7, description: "" },
      { id: "2-thu", day: "thu", type: "easy", targetDistanceKm: 2, targetPaceMinPerKm: 7, description: "" },
      { id: "2-sat", day: "sat", type: "long", targetDistanceKm: 3, targetPaceMinPerKm: 7, description: "" },
    ],
  };
  const checkins = [
    mkCheckin({ weekNumber: 2, completed: true, userRpe: 9, sessionId: "a" }),
    mkCheckin({ weekNumber: 2, completed: true, userRpe: 9, sessionId: "b" }),
    mkCheckin({ weekNumber: 2, completed: false, userRpe: 9, skippedReason: "time", sessionId: "c" }),
  ];
  const input = buildEvaluationInputFromCheckins({
    userId: "1",
    planId: "singleton",
    weekNumber: 2,
    checkins,
    planWeek,
  });
  const r = evaluateNoviceWeek(input, baseCfg, 2, {});
  assert("struggle mid completion reduce", r.decision === "REDUCE_LOAD");
}

// Illness + completion <67% → REPEAT
{
  const planWeek: TrainingWeek = {
    week: 2,
    phase: "Beginner Base",
    isCutback: false,
    sessions: [
      { id: "2-tue", day: "tue", type: "easy", targetDistanceKm: 2, targetPaceMinPerKm: 7, description: "" },
      { id: "2-thu", day: "thu", type: "easy", targetDistanceKm: 2, targetPaceMinPerKm: 7, description: "" },
      { id: "2-sat", day: "sat", type: "long", targetDistanceKm: 3, targetPaceMinPerKm: 7, description: "" },
    ],
  };
  const checkins = [
    mkCheckin({ weekNumber: 2, completed: false, userRpe: 5, skippedReason: "illness", sessionId: "a" }),
    mkCheckin({ weekNumber: 2, completed: true, userRpe: 4, sessionId: "b" }),
    mkCheckin({ weekNumber: 2, completed: false, userRpe: 5, skippedReason: "time", sessionId: "c" }),
  ];
  const input = buildEvaluationInputFromCheckins({
    userId: "1",
    planId: "singleton",
    weekNumber: 2,
    checkins,
    planWeek,
  });
  const r = evaluateNoviceWeek(input, baseCfg, 2, {});
  assert("illness repeat", r.decision === "REPEAT_WEEK");
}

// Repeat cap → REDUCE_LOAD
{
  const planWeek: TrainingWeek = {
    week: 3,
    phase: "Beginner Base",
    isCutback: false,
    sessions: [{ id: "3-tue", day: "tue", type: "easy", targetDistanceKm: 2, targetPaceMinPerKm: 7, description: "" }],
  };
  const checkins = [mkCheckin({ weekNumber: 3, completed: false, userRpe: 5, skippedReason: "time" })];
  const input = buildEvaluationInputFromCheckins({
    userId: "1",
    planId: "singleton",
    weekNumber: 3,
    checkins,
    planWeek,
  });
  const rt = defaultNoviceRuntimeState();
  rt.weekRepeatCounts["3"] = 2;
  const r = evaluateNoviceWeek(input, baseCfg, 3, { noviceRuntime: rt });
  assert("repeat cap reduce", r.decision === "REDUCE_LOAD");
}

// ACCELERATE
{
  const planWeek: TrainingWeek = {
    week: 4,
    phase: "Beginner Base",
    isCutback: false,
    sessions: [
      { id: "4-tue", day: "tue", type: "easy", targetDistanceKm: 2, targetPaceMinPerKm: 7, description: "" },
      { id: "4-sat", day: "sat", type: "long", targetDistanceKm: 3, targetPaceMinPerKm: 7, description: "" },
    ],
  };
  const checkins = [
    mkCheckin({
      weekNumber: 4,
      completed: true,
      userRpe: 3,
      actualDistanceKm: 2,
      effortScore: 3,
      sessionId: "a",
    }),
    mkCheckin({
      weekNumber: 4,
      completed: true,
      userRpe: 4,
      actualDistanceKm: 3,
      effortScore: 4,
      sessionId: "b",
      sessionType: "long",
    }),
  ];
  const input = buildEvaluationInputFromCheckins({
    userId: "1",
    planId: "singleton",
    weekNumber: 4,
    checkins,
    planWeek,
  });
  const r = evaluateNoviceWeek(input, baseCfg, 4, { noviceRuntime: defaultNoviceRuntimeState() });
  assert("accelerate", r.decision === "ACCELERATE");
}

// Normal → PROGRESS
{
  const planWeek: TrainingWeek = {
    week: 5,
    phase: "Beginner Base",
    isCutback: false,
    sessions: [
      { id: "5-tue", day: "tue", type: "easy", targetDistanceKm: 2, targetPaceMinPerKm: 7, description: "" },
      { id: "5-sat", day: "sat", type: "long", targetDistanceKm: 3, targetPaceMinPerKm: 7, description: "" },
    ],
  };
  const checkins = [
    mkCheckin({ weekNumber: 5, completed: true, userRpe: 6, sessionId: "a" }),
    mkCheckin({ weekNumber: 5, completed: true, userRpe: 6, sessionId: "b", sessionType: "long" }),
  ];
  const input = buildEvaluationInputFromCheckins({
    userId: "1",
    planId: "singleton",
    weekNumber: 5,
    checkins,
    planWeek,
  });
  const r = evaluateNoviceWeek(input, baseCfg, 5, { noviceRuntime: defaultNoviceRuntimeState() });
  assert("normal progress", r.decision === "PROGRESS");
}

// Mutations: REPEAT_WEEK extends plan
{
  const w1: TrainingWeek = {
    week: 1,
    phase: "Beginner Base",
    isCutback: false,
    sessions: [{ id: "1-tue", day: "tue", type: "easy", targetDistanceKm: 2, targetPaceMinPerKm: 7, description: "" }],
  };
  const w2: TrainingWeek = {
    week: 2,
    phase: "Beginner Base",
    isCutback: false,
    sessions: [{ id: "2-tue", day: "tue", type: "easy", targetDistanceKm: 3, targetPaceMinPerKm: 7, description: "" }],
  };
  const bundle = { weeks: [w1, w2], noviceRuntime: defaultNoviceRuntimeState() };
  const { bundle: out } = applyNoviceAdaptiveDecision(bundle, "REPEAT_WEEK", 1, baseCfg, "eval1", "singleton");
  assert("repeat extends", out.weeks.length === 3);
  assert("repeat copy", out.weeks[1].sessions[0].targetDistanceKm === 2);
}

// REDUCE_LOAD scales next week
{
  const w1: TrainingWeek = {
    week: 1,
    phase: "Beginner Base",
    isCutback: false,
    sessions: [{ id: "1-tue", day: "tue", type: "easy", targetDistanceKm: 10, targetPaceMinPerKm: 7, description: "" }],
  };
  const w2: TrainingWeek = {
    week: 2,
    phase: "Beginner Base",
    isCutback: false,
    sessions: [{ id: "2-tue", day: "tue", type: "easy", targetDistanceKm: 10, targetPaceMinPerKm: 7, description: "" }],
  };
  const { bundle: out } = applyNoviceAdaptiveDecision(
    { weeks: [w1, w2], noviceRuntime: defaultNoviceRuntimeState() },
    "REDUCE_LOAD",
    1,
    baseCfg,
    "eval2",
    "singleton",
  );
  assert("reduce w2", out.weeks[1].sessions[0].targetDistanceKm === 8);
}

// ACCELERATE shortens
{
  const weeks: TrainingWeek[] = [1, 2, 3].map((n) => ({
    week: n,
    phase: "Beginner Base" as const,
    isCutback: false,
    sessions: [
      {
        id: `${n}-tue`,
        day: "tue" as const,
        type: "easy" as const,
        targetDistanceKm: 2,
        targetPaceMinPerKm: 7,
        description: "",
      },
    ],
  }));
  const { bundle: out } = applyNoviceAdaptiveDecision(
    { weeks, noviceRuntime: defaultNoviceRuntimeState() },
    "ACCELERATE",
    1,
    baseCfg,
    "eval3",
    "singleton",
  );
  assert("accelerate shortens", out.weeks.length === 2);
}

// PAUSE_INJURY
{
  const weeks: TrainingWeek[] = [
    {
      week: 1,
      phase: "Beginner Base",
      isCutback: false,
      sessions: [
        { id: "1-tue", day: "tue", type: "easy", targetDistanceKm: 2, targetPaceMinPerKm: 7, description: "" },
      ],
    },
  ];
  const { bundle: out } = applyNoviceAdaptiveDecision(
    { weeks, noviceRuntime: defaultNoviceRuntimeState() },
    "PAUSE_INJURY",
    1,
    baseCfg,
    "eval4",
    "singleton",
  );
  assert("pause status", out.noviceRuntime?.planStatus === "PAUSED_INJURY");
  assert("pause weeks unchanged", out.weeks[0].sessions[0].targetDistanceKm === 2);
}

// Graduation
{
  const planWeeks: TrainingWeek[] = [
    {
      week: 12,
      phase: "Taper",
      isCutback: false,
      sessions: [
        { id: "12-tue", day: "tue", type: "easy", targetDistanceKm: 2, targetPaceMinPerKm: 7, description: "" },
        { id: "12-sat", day: "sat", type: "long", targetDistanceKm: 5, targetPaceMinPerKm: 7, description: "" },
      ],
    },
  ];
  const g = evaluateNoviceGraduation({
    userId: "1",
    config: baseCfg,
    planWeeks,
    planStatus: "ACTIVE",
    finalWeekEvaluation: { weekNumber: 12, completionRate: 0.7, hasInjuryFlag: false },
    bestLongRunKmLastFourWeeks: 5,
    totalSessionsCompleted: 30,
    totalKmCovered: 120,
    peakWeeklyKm: 20,
    averageWeeklyRpe: 5,
    estimatedPaceSecPerKm: 360,
  });
  assert("graduate eligible", g.eligible === true);
}

{
  const planWeeks: TrainingWeek[] = [
    {
      week: 12,
      phase: "Taper",
      isCutback: false,
      sessions: [{ id: "12-tue", day: "tue", type: "easy", targetDistanceKm: 2, targetPaceMinPerKm: 7, description: "" }],
    },
  ];
  const g = evaluateNoviceGraduation({
    userId: "1",
    config: baseCfg,
    planWeeks,
    planStatus: "ACTIVE",
    finalWeekEvaluation: { weekNumber: 12, completionRate: 0.5, hasInjuryFlag: false },
    bestLongRunKmLastFourWeeks: 5,
    totalSessionsCompleted: 10,
    totalKmCovered: 40,
    peakWeeklyKm: 10,
    averageWeeklyRpe: 5,
    estimatedPaceSecPerKm: null,
  });
  assert("graduate not low completion", g.eligible === false);
}

{
  const planWeeks: TrainingWeek[] = [
    {
      week: 12,
      phase: "Taper",
      isCutback: false,
      sessions: [{ id: "12-tue", day: "tue", type: "easy", targetDistanceKm: 2, targetPaceMinPerKm: 7, description: "" }],
    },
  ];
  const g = evaluateNoviceGraduation({
    userId: "1",
    config: baseCfg,
    planWeeks,
    planStatus: "ACTIVE",
    finalWeekEvaluation: { weekNumber: 12, completionRate: 0.8, hasInjuryFlag: true },
    bestLongRunKmLastFourWeeks: 5,
    totalSessionsCompleted: 20,
    totalKmCovered: 80,
    peakWeeklyKm: 15,
    averageWeeklyRpe: 5,
    estimatedPaceSecPerKm: null,
  });
  assert("graduate not injury", g.eligible === false);
}

assert("suggest 5k→10k", suggestNextGoal("5k") === "10k");
assert("suggest 10k→half", suggestNextGoal("10k") === "half");

console.log("Phase 3 script done. Exit:", process.exitCode ?? 0);
