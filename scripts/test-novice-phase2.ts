/**
 * Phase 2 verification: Novice bridge tempo, RPE, run/walk gap, plan metadata.
 */
import { generatePlan, assignSessionsTodays } from "@/lib/generatePlan";
import {
  getNoviceRunWalkTransitionWeek,
  getNoviceTempoWindowStart,
} from "@/lib/novicePlanCaps";
import type { Day, PlanConfig, TrainingWeek } from "@/data/trainingPlan";

function assert(name: string, cond: boolean, detail?: string) {
  if (!cond) {
    console.error(`FAIL: ${name}${detail ? ` — ${detail}` : ""}`);
    process.exitCode = 1;
  } else {
    console.log(`ok: ${name}`);
  }
}

function tempoCount(plan: TrainingWeek[], w: number) {
  const week = plan[w - 1];
  return week.sessions.filter((s) => s.type === "tempo").length;
}

function gapWeeks(weeks: PlanConfig["weeks"]): number {
  const tw = getNoviceRunWalkTransitionWeek(weeks);
  const ts = getNoviceTempoWindowStart(weeks);
  return ts - tw - 1;
}

const DAYS_3: Day[] = ["tue", "thu", "sat"];
const DAYS_4: Day[] = ["mon", "tue", "thu", "sat"];
const DAYS_6: Day[] = ["mon", "tue", "wed", "thu", "fri", "sat"];

// Gap run/walk end → tempo start ≥ 2 weeks
for (const w of [8, 12, 16, 20] as const) {
  assert(`gap>=2 weeks=${w}`, gapWeeks(w) >= 2, `gap=${gapWeeks(w)}`);
}

// 5K / 12w / 2 sessions
{
  const cfg: PlanConfig = {
    level: "NOVICE",
    goal: "5k",
    weeks: 12,
    days: ["mon", "thu"],
    longRunDay: "thu",
    vdot: 28,
  };
  const plan = generatePlan(cfg).weeks;
  for (const w of [1, 2, 3, 4, 5, 6, 7, 8, 9]) {
    assert(`12w2d W${w} no tempo`, tempoCount(plan, w) === 0);
  }
  assert("12w2d W10 tempo", tempoCount(plan, 10) === 1);
  assert("12w2d W11 tempo", tempoCount(plan, 11) === 1);
  assert("12w2d W12 no tempo", tempoCount(plan, 12) === 0);
}

// 5K / 8w / 3 sessions — week 7 one tempo, week 8 no tempo
{
  const plan = generatePlan({
    level: "NOVICE",
    goal: "5k",
    weeks: 8,
    days: DAYS_3,
    longRunDay: "sat",
    vdot: 28,
  }).weeks;
  assert("8w3d W7 one tempo", tempoCount(plan, 7) === 1);
  assert("8w3d W8 no tempo", tempoCount(plan, 8) === 0);
}

// 10K / 16w / 4 — tempo W13–14 only, W15–16 none
{
  const plan = generatePlan({
    level: "NOVICE",
    goal: "10k",
    weeks: 16,
    days: DAYS_4,
    longRunDay: "sat",
    vdot: 28,
  }).weeks;
  assert("16w4d W13 tempo", tempoCount(plan, 13) === 1);
  assert("16w4d W14 tempo", tempoCount(plan, 14) === 1);
  assert("16w4d W15 no tempo", tempoCount(plan, 15) === 0);
  assert("16w4d W16 no tempo", tempoCount(plan, 16) === 0);
}

// 10K / 20w / 6 — tempo W17–19, W20 none
{
  const plan = generatePlan({
    level: "NOVICE",
    goal: "10k",
    weeks: 20,
    days: DAYS_6,
    longRunDay: "sat",
    vdot: 28,
  }).weeks;
  for (const w of [17, 18, 19]) {
    assert(`20w6d W${w} one tempo`, tempoCount(plan, w) === 1);
  }
  assert("20w6d W20 no tempo", tempoCount(plan, 20) === 0);
}

// RPE + no runWalk on bridge tempo (8w W7)
{
  const plan = generatePlan({
    level: "NOVICE",
    goal: "5k",
    weeks: 8,
    days: DAYS_3,
    longRunDay: "sat",
    vdot: 28,
  }).weeks;
  const w7 = plan[6];
  for (const s of w7.sessions) {
    if (s.type === "easy") assert("W7 easy RPE3", s.targetRpe === 3);
    if (s.type === "long") assert("W7 long RPE4", s.targetRpe === 4);
    if (s.type === "tempo") {
      assert("W7 tempo RPE5", s.targetRpe === 5);
      assert("W7 tempo no runWalk", !s.structure?.runWalkRatio);
    }
  }
}

// Plan metadata
{
  const plan = generatePlan({
    level: "NOVICE",
    goal: "5k",
    weeks: 12,
    days: DAYS_3,
    longRunDay: "sat",
    vdot: 28,
  }).weeks;
  assert("noviceGraduationEligible", plan[0].noviceGraduationEligible === true);
  assert("noviceTempoWindowStart", plan[0].noviceTempoWindowStart === getNoviceTempoWindowStart(12));
}

// assignSessionsTodays W9 no tempo (12w 2d)
{
  const a = assignSessionsTodays(["mon", "thu"], "thu", "NOVICE", { goal: "5k", weeks: 12 }, 9);
  assert("assign W9 mon easy", a.mon === "easy");
}

console.log("Phase 2 script finished. Exit code:", process.exitCode ?? 0);
