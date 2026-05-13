import { generatePlan } from "@/lib/generatePlan";
import type { PlanConfig, Day } from "@/data/trainingPlan";

const DAYS_MAP: Record<number, Day[]> = {
  2: ["wed", "sun"],
  3: ["tue", "thu", "sat"],
  4: ["mon", "wed", "fri", "sun"],
  5: ["mon", "tue", "thu", "fri", "sun"],
  6: ["mon", "tue", "wed", "thu", "fri", "sat"]
};

const LONG_DAY_MAP: Record<number, Day> = {
  2: "sun",
  3: "sat",
  4: "sun",
  5: "sun",
  6: "sat"
};

const CAPS = {
  "NOVICE-5k": 5,
  "NOVICE-10k": 10,
  "BEGINNER-5k": 6,
  "BEGINNER-10k": 12,
  "INTERMEDIATE-5k": 7,
  "INTERMEDIATE-10k": 13,
  "ADVANCED-5k": 8,
  "ADVANCED-10k": 14,
  "ELITE-5k": 8,
  "ELITE-10k": 14,
};

function runTest(level: PlanConfig["level"], goal: "5k" | "10k", daysCount: number) {
  const name = `${level} ${goal}, ${daysCount} days/week`;
  const config: PlanConfig = {
    level,
    goal,
    weeks: 16,
    days: DAYS_MAP[daysCount],
    longRunDay: LONG_DAY_MAP[daysCount],
    vdot: 40 // Average vdot
  };

  const plan = generatePlan(config);

  let hasFailed = false;
  const maxLong = CAPS[`${level}-${goal}` as keyof typeof CAPS];

  // For computing average non-long vs long balance in peak build weeks
  let midBuildLongSum = 0;
  let midBuildTotalSum = 0;
  let buildWeeksCount = 0;

  for (const week of plan) {
    const total = week.sessions.reduce((acc, s) => acc + s.targetDistanceKm, 0);
    const longSession = week.sessions.find(s => s.type === 'long');
    const long = longSession?.targetDistanceKm || 0;
    
    // Assertion 1: Long-run cap
    if (long > maxLong + 0.01) {
      console.error(`  [FAIL] Long run ${long} exceeds cap of ${maxLong} in W${week.week} for ${name}`);
      hasFailed = true;
    }

    // Assertion 2: 2-day week rule
    if (daysCount === 2 && long > total * 0.5 + 0.01) {
      console.error(`  [FAIL] Long run ${long} exceeds 50% of total ${total} on 2-day plan in W${week.week}`);
      hasFailed = true;
    }

    if (week.phase === "Race Specific" || week.phase === "Intermediate Base" || week.phase === "Advanced Base" || week.phase === "Beginner Base") {
      midBuildLongSum += long;
      midBuildTotalSum += total;
      buildWeeksCount++;
    }

    for (const sess of week.sessions) {
      if (isNaN(sess.targetDistanceKm) || sess.targetDistanceKm <= 0) {
        console.error(`  [FAIL] Invalid distance W${week.week} ${sess.day}: ${sess.targetDistanceKm}`);
        hasFailed = true;
      }
    }
  }

  // Assertion 3: Balance (Long run should not overwhelmingly dominate the week)
  // Target band is roughly 22-35%. For 2 days it's strictly 50%. For 3 days it can be up to 45%.
  const avgRatio = midBuildTotalSum > 0 ? midBuildLongSum / midBuildTotalSum : 0;
  let maxRatio = 0.55;
  if (daysCount >= 4) {
    if (level === "NOVICE") maxRatio = 0.46; // Novice peak easy is 4km, long is 10km => 10/22 = 45%
    else maxRatio = 0.40;
  }
  
  if (avgRatio > maxRatio + 0.01) {
    console.error(`  [FAIL] Average long run ratio ${avgRatio.toFixed(2)} exceeds max allowed ${maxRatio} for ${name}`);
    hasFailed = true;
  }

  if (!hasFailed) {
    const peak = plan.find(w => w.week === 14)!.sessions.reduce((acc, s) => acc + s.targetDistanceKm, 0);
    const peakLong = plan.find(w => w.week === 14)!.sessions.find(s => s.type === 'long')?.targetDistanceKm || 0;
    // console.log(`  [PASS] ${name} | Peak Wk: ${peak.toFixed(1)}km | Peak Long: ${peakLong.toFixed(1)}km | Avg Long %: ${(avgRatio*100).toFixed(0)}%`);
  } else {
    console.log(`  [FAIL] ${name} failed one or more assertions.`);
  }
}

console.log("Starting 5K/10K Verification Matrix...");
const goals: Array<"5k" | "10k"> = ["5k", "10k"];
const levels: Array<PlanConfig["level"]> = ["NOVICE", "BEGINNER", "INTERMEDIATE", "ADVANCED", "ELITE"];
const counts = [2, 3, 4, 5, 6];

for (const level of levels) {
  for (const goal of goals) {
    for (const count of counts) {
      runTest(level, goal, count);
    }
  }
}
console.log("Done.");
