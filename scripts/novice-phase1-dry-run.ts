/**
 * Phase 1 dry-run: log weekly total km for Novice 5K/10K × 8/12/16/20 weeks at 3 sessions/week.
 * Also samples 5K/12w @ 2 days and 10K/20w @ 6 days for rebalance / two-day rule.
 */
import {
  generatePlan,
} from "@/lib/generatePlan";
import { getNovicePeakWeeklyKm, getNoviceRunWalkTransitionWeek } from "@/lib/novicePlanCaps";
import type { Day, PlanConfig, TrainingWeek } from "@/data/trainingPlan";

const DAYS_3: Day[] = ["tue", "thu", "sat"];
const LONG_3: Day = "sat";

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function weeklyTotals(plan: TrainingWeek[]): number[] {
  return plan.map((w) => round1(w.sessions.reduce((a, s) => a + s.targetDistanceKm, 0)));
}

function logConfig(label: string, config: PlanConfig) {
  const plan = generatePlan(config).weeks;
  const totals = weeklyTotals(plan);
  const lastNonTaper = [...plan].reverse().find((w) => w.phase !== "Taper")?.week ?? plan.length;
  const peakWkKm = totals[lastNonTaper - 1];
  const cap = getNovicePeakWeeklyKm(config.goal, config.weeks);
  const tw = getNoviceRunWalkTransitionWeek(config.weeks);
  console.log(`\n=== ${label} ===`);
  console.log(`  cap=${cap} km  transitionWeeks=${tw}  lastNonTaperWk=${lastNonTaper} peakWkTotal=${peakWkKm}`);
  console.log(`  weeklyKm: [${totals.join(", ")}]`);
  const w1 = plan[0];
  const rw = w1.sessions[0]?.structure?.runWalkRatio;
  console.log(`  W1 runWalk (first session):`, rw ? `${rw.runSec}s run / ${rw.walkSec}s walk` : "(none)");
  const wLastTrans = plan.find((x) => x.week === tw);
  const rwLast = wLastTrans?.sessions.find((s) => s.structure?.runWalkRatio)?.structure?.runWalkRatio;
  console.log(`  W${tw} runWalk (long or first with ratio):`, rwLast ? `${rwLast.runSec}s / ${rwLast.walkSec}s` : "(none)");
  const wFirstAfter = plan.find((x) => x.week === tw + 1);
  const ratioAfterTrans = wFirstAfter?.sessions.some((s) => s.structure?.runWalkRatio != null);
  console.log(`  W${tw + 1} any runWalkRatio: ${ratioAfterTrans}`);
}

const base3 = (goal: "5k" | "10k", weeks: PlanConfig["weeks"]): PlanConfig => ({
  level: "NOVICE",
  goal,
  weeks,
  days: DAYS_3,
  longRunDay: LONG_3,
  vdot: 28,
});

console.log("Novice Phase 1 dry-run");
for (const weeks of [8, 12, 16, 20] as const) {
  logConfig(`5K / ${weeks}w / 3 sessions`, base3("5k", weeks));
}
for (const weeks of [8, 12, 16, 20] as const) {
  logConfig(`10K / ${weeks}w / 3 sessions`, base3("10k", weeks));
}

logConfig("5K / 12w / 2 sessions (wed,sun long sun)", {
  level: "NOVICE",
  goal: "5k",
  weeks: 12,
  days: ["wed", "sun"],
  longRunDay: "sun",
  vdot: 28,
});

logConfig("10K / 20w / 6 sessions", {
  level: "NOVICE",
  goal: "10k",
  weeks: 20,
  days: ["mon", "tue", "wed", "thu", "fri", "sat"],
  longRunDay: "sat",
  vdot: 28,
});
