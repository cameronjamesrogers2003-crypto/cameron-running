/**
 * Verification for long-run integrity (HM/Full, 12–20w, B/I/A).
 * Run: npx tsx scripts/test-long-run-integrity.ts
 */
import type { Day, PlanConfig } from "@/data/trainingPlan";
import { buildWeeklyVolumes, generatePlan, weekAcuteToChronicOk } from "@/lib/generatePlan";

const DAYS_2: Day[] = ["tue", "sat"];
const DAYS_3: Day[] = ["mon", "wed", "sun"];
const DAYS_4: Day[] = ["mon", "tue", "thu", "sun"];
const DAYS_5: Day[] = ["mon", "tue", "wed", "fri", "sun"];
const DAYS_6: Day[] = ["mon", "tue", "wed", "thu", "fri", "sat"];

const MATRIX: PlanConfig[] = [
  { level: "BEGINNER", goal: "hm", weeks: 12, days: DAYS_3, longRunDay: "sun", vdot: 33 },
  { level: "BEGINNER", goal: "hm", weeks: 16, days: DAYS_4, longRunDay: "sun", vdot: 33 },
  { level: "BEGINNER", goal: "hm", weeks: 20, days: DAYS_5, longRunDay: "sun", vdot: 33 },
  { level: "INTERMEDIATE", goal: "hm", weeks: 16, days: DAYS_3, longRunDay: "sun", vdot: 40 },
  { level: "INTERMEDIATE", goal: "full", weeks: 20, days: DAYS_4, longRunDay: "sun", vdot: 42 },
  { level: "ADVANCED", goal: "hm", weeks: 20, days: DAYS_5, longRunDay: "sun", vdot: 50 },
  { level: "ADVANCED", goal: "full", weeks: 20, days: DAYS_6, longRunDay: "sat", vdot: 52 },
  { level: "BEGINNER", goal: "hm", weeks: 12, days: DAYS_2, longRunDay: "sat", vdot: 33 },
  { level: "BEGINNER", goal: "full", weeks: 16, days: DAYS_2, longRunDay: "sat", vdot: 33 },
];

function minLongKm(level: PlanConfig["level"], goal: PlanConfig["goal"], isCutback: boolean): number {
  if (isCutback) return 0;
  if (goal === "hm") {
    if (level === "BEGINNER") return 8;
    if (level === "INTERMEDIATE") return 10;
    if (level === "ADVANCED") return 12;
  }
  if (goal === "full") {
    if (level === "BEGINNER") return 12;
    if (level === "INTERMEDIATE") return 14;
    if (level === "ADVANCED") return 16;
  }
  return 0;
}

function minEasyKm(level: PlanConfig["level"]): number {
  if (level === "BEGINNER") return 4;
  if (level === "INTERMEDIATE") return 5;
  if (level === "ADVANCED") return 6;
  return 4;
}

function main() {
  const errors: string[] = [];

  for (const cfg of MATRIX) {
    const label = `${cfg.level} ${cfg.goal} ${cfg.weeks}w ${cfg.days.length}d`;
    const { weeklyKm } = buildWeeklyVolumes({ ...cfg, days: cfg.days });
    const { weeks } = generatePlan(cfg);
    const history: number[] = [];

    for (const w of weeks) {
      const totalKm = round1(w.sessions.reduce((s, x) => s + x.targetDistanceKm, 0));
      history.push(totalKm);

      const isTaper = w.phase === "Taper";
      const long = w.sessions.find((s) => s.type === "long")?.targetDistanceKm ?? 0;
      const nonLong = w.sessions.filter((s) => s.type !== "long").map((s) => s.targetDistanceKm);
      const maxNonLong = nonLong.length ? Math.max(...nonLong) : 0;

      if (!isTaper && w.week >= 3) {
        if (long + 0.15 < maxNonLong * 1.4) {
          errors.push(`${label} W${w.week}: long ${long} < 1.4× max non-long ${maxNonLong}`);
        }
        const m = minLongKm(cfg.level, cfg.goal, w.isCutback);
        if (m > 0 && long + 1e-6 < m) {
          errors.push(`${label} W${w.week}: long ${long} < min ${m}`);
        }
      }

      for (const s of w.sessions) {
        if (s.type === "easy" && s.targetDistanceKm + 1e-6 < minEasyKm(cfg.level)) {
          errors.push(`${label} W${w.week}: easy ${s.targetDistanceKm} < min ${minEasyKm(cfg.level)}`);
        }
      }

      if (!weekAcuteToChronicOk(totalKm, w.week, history.slice(0, -1), weeklyKm)) {
        if (!isTaper) {
          errors.push(`${label} W${w.week}: ACWR (blended) exceeds 1.25`);
        }
      }
    }
  }

  const threeCfg: PlanConfig = {
    level: "INTERMEDIATE",
    goal: "hm",
    weeks: 16,
    days: DAYS_3,
    longRunDay: "sun",
    vdot: 40,
  };
  const sixCfg: PlanConfig = { ...threeCfg, days: DAYS_6, longRunDay: "sat" };
  const { weeklyKm: wk3 } = buildWeeklyVolumes({ ...threeCfg, days: DAYS_3 });
  const { weeklyKm: wk6 } = buildWeeklyVolumes({ ...sixCfg, days: DAYS_6 });
  const three = generatePlan(threeCfg).weeks;
  for (let i = 0; i < 16; i++) {
    if (three[i].phase === "Taper") continue;
    if (wk6[i] + 1e-6 < wk3[i]) {
      errors.push(`INTER hm 16w W${i + 1}: planned weeklyKm 6d ${wk6[i]} < 3d ${wk3[i]}`);
    }
  }

  const two = generatePlan({
    level: "BEGINNER",
    goal: "hm",
    weeks: 12,
    days: DAYS_2,
    longRunDay: "sat",
    vdot: 33,
  }).weeks;
  const thr = generatePlan({
    level: "BEGINNER",
    goal: "hm",
    weeks: 12,
    days: DAYS_3,
    longRunDay: "sun",
    vdot: 33,
  }).weeks;
  for (const wk of two) {
    if (wk.phase === "Taper" || wk.week < 4 || wk.week > 7) continue;
    const max2 = Math.max(...two[wk.week - 1].sessions.map((s) => s.targetDistanceKm));
    const max3 = Math.max(...thr[wk.week - 1].sessions.map((s) => s.targetDistanceKm));
    if (max2 + 1e-6 < max3) {
      errors.push(`BEGINNER hm 12w W${wk.week}: max session 2d ${max2} < 3d ${max3}`);
    }
  }

  if (errors.length) {
    console.error("FAILURES:\n" + errors.join("\n"));
    process.exit(1);
  }
  console.log("All long-run integrity checks passed for matrix.");
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

main();
