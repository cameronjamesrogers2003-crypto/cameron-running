import { getVdotPaces } from "@/lib/vdot";
import type { Day, Phase, PlanConfig, RunType, Session, TrainingWeek } from "@/data/trainingPlan";

const DAY_INDEX: Record<Day, number> = {
  mon: 0,
  tue: 1,
  wed: 2,
  thu: 3,
  fri: 4,
  sat: 5,
  sun: 6,
};

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function uniqDays(days: Day[]): Day[] {
  const seen = new Set<Day>();
  const out: Day[] = [];
  for (const d of days) {
    if (!seen.has(d)) {
      seen.add(d);
      out.push(d);
    }
  }
  return out;
}

function daysSorted(days: Day[]): Day[] {
  return [...days].sort((a, b) => DAY_INDEX[a] - DAY_INDEX[b]);
}

function circularDayDistance(a: Day, b: Day): number {
  const raw = Math.abs(DAY_INDEX[a] - DAY_INDEX[b]);
  return Math.min(raw, 7 - raw);
}

const DAY_COUNT_MULTIPLIER: Record<number, number> = {
  2: 0.65,
  3: 1.0,
  4: 1.2,
  5: 1.4,
  6: 1.6,
};

function nearestTrainingDayDistance(day: Day, trainingSet: Set<Day>): number {
  // distance in days to closest other training day (0 if none / self only)
  if (trainingSet.size <= 1) return 0;
  let best = 7;
  for (const d of trainingSet) {
    if (d === day) continue;
    const dist = circularDayDistance(d, day);
    best = Math.min(best, dist);
  }
  return best === 7 ? 0 : best;
}

function isHard(t: RunType): boolean {
  return t === "tempo" || t === "interval";
}

export function hasConsecutiveHardSessions(
  days: Day[],
  assignment: Partial<Record<Day, RunType>>,
): boolean {
  const sorted = daysSorted(uniqDays(days));
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    if (Math.abs(DAY_INDEX[curr] - DAY_INDEX[prev]) !== 1) continue;
    const pt = assignment[prev];
    const ct = assignment[curr];
    if (pt && ct && isHard(pt) && isHard(ct)) return true;
  }
  return false;
}

function basePhaseForLevel(level: PlanConfig["level"]): Phase {
  switch (level) {
    case "BEGINNER":
      return "Beginner Base";
    case "INTERMEDIATE":
      return "Intermediate Base";
    case "ADVANCED":
      return "Advanced Base";
    default:
      return "Beginner Base";
  }
}

function phaseForWeek(config: PlanConfig, week: number): Phase {
  const weeks = config.weeks;
  const goal = config.goal;

  // Derive base/build/taper boundaries from the prompt.
  const structure = (() => {
    if (weeks === 12) {
      return goal === "hm"
        ? { baseEnd: 4, buildEnd: 9, taperStart: 10, taperWeeks: 3 } // weeks 10–12 are taper/race block
        : { baseEnd: 4, buildEnd: 9, taperStart: 10, taperWeeks: 3 };
    }
    if (weeks === 16) {
      return goal === "hm"
        ? { baseEnd: 6, buildEnd: 14, taperStart: 15, taperWeeks: 2 }
        : { baseEnd: 6, buildEnd: 13, taperStart: 14, taperWeeks: 3 };
    }
    // 20
    return goal === "hm"
      ? { baseEnd: 8, buildEnd: 18, taperStart: 19, taperWeeks: 2 }
      : { baseEnd: 8, buildEnd: 17, taperStart: 18, taperWeeks: 3 };
  })();

  if (week <= structure.baseEnd) return basePhaseForLevel(config.level);
  if (week >= structure.taperStart) return "Taper";
  return "Race Specific";
}

function getCutbackConfig(level: PlanConfig["level"]) {
  if (level === "BEGINNER") return { every: 3, reduce: 0.20, maxIncrease: 0.10 };
  if (level === "INTERMEDIATE") return { every: 4, reduce: 0.25, maxIncrease: 0.15 };
  return { every: 4, reduce: 0.30, maxIncrease: 0.20 };
}

function getPeakWeeklyKm(level: PlanConfig["level"], goal: PlanConfig["goal"]): number {
  const key = `${level}-${goal}`;
  switch (key) {
    case "BEGINNER-hm": return 45;
    case "BEGINNER-full": return 64;
    case "INTERMEDIATE-hm": return 65;
    case "INTERMEDIATE-full": return 84;
    case "ADVANCED-hm": return 90;
    case "ADVANCED-full": return 100;
    default: return 45;
  }
}

function getStartWeeklyKm(level: PlanConfig["level"], peak: number): number {
  const frac = level === "BEGINNER" ? 0.70 : level === "INTERMEDIATE" ? 0.75 : 0.80;
  return peak * frac;
}

function taperWeeklyKm(config: PlanConfig, peak: number, week: number): number {
  // Maps taper week index to % of peak.
  // HM: -30%, -50% (race). For 12w HM, the prompt describes weeks 10–11 taper + week 12 race;
  // we keep week 12 at race volume (-50%) to avoid increasing volume on race week.
  const weeks = config.weeks;
  const goal = config.goal;

  const taperStart = phaseForWeek(config, 1) === "Taper" ? 1 : (() => {
    for (let w = 1; w <= weeks; w++) {
      if (phaseForWeek(config, w) === "Taper") return w;
    }
    return weeks;
  })();

  const idx = week - taperStart; // 0-based into taper block
  if (goal === "hm") {
    if (idx === 0) return peak * 0.70;
    return peak * 0.50;
  }
  // full: -20, -35, -50
  if (idx === 0) return peak * 0.80;
  if (idx === 1) return peak * 0.65;
  return peak * 0.50;
}

function isBasePhase(phase: Phase): boolean {
  return phase === "Base" || phase === "Beginner Base" || phase === "Intermediate Base" || phase === "Advanced Base";
}

function getPhaseWindows(config: Pick<PlanConfig, "weeks" | "goal">, weekNumber: number): {
  baseLengthWeeks: number;
  isBase: boolean;
  isBuild: boolean;
  isTaper: boolean;
} {
  const baseLengthWeeks = config.weeks === 12 ? 4 : config.weeks === 16 ? 6 : 8;
  const isBase = weekNumber <= baseLengthWeeks;
  const taperLength = config.goal === "full" ? 3 : 2;
  const isTaper = weekNumber > config.weeks - taperLength;
  const isBuild = !isBase && !isTaper;
  return { baseLengthWeeks, isBase, isBuild, isTaper };
}

function resolveHardType(level: PlanConfig["level"], config: PlanConfig, weekNumber: number): RunType {
  const { baseLengthWeeks, isBase, isBuild } = getPhaseWindows(config, weekNumber);

  if (level === "BEGINNER") {
    if (isBase) return weekNumber <= 3 ? "easy" : "tempo";
    if (isBuild) return "tempo";
    return "easy";
  }
  if (level === "INTERMEDIATE") {
    if (isBase) return "tempo";
    if (isBuild) return weekNumber <= baseLengthWeeks + 2 ? "tempo" : "interval";
    return "easy";
  }
  if (isBase) return "tempo";
  if (isBuild) return "interval";
  return "easy";
}

export function getDefaultLongRunDay(days: Day[]): Day {
  const uniq = daysSorted(uniqDays(days));
  if (uniq.length === 0) return "sat";
  let best = uniq[0];
  let bestGap = nearestTrainingDayDistance(best, new Set(uniq));
  for (const day of uniq) {
    const minGap = nearestTrainingDayDistance(day, new Set(uniq));
    if (minGap > bestGap) {
      best = day;
      bestGap = minGap;
    }
  }
  return best;
}

export function getScheduleWarnings(
  days: Day[],
  longRunDay: Day,
  level?: PlanConfig["level"],
): string[] {
  const sortedDays = daysSorted(uniqDays(days));
  if (sortedDays.length === 0 || !sortedDays.includes(longRunDay)) return [];

  const warnings: string[] = [];
  const dayAfterLongIndex = (DAY_INDEX[longRunDay] + 1) % 7;
  const dayAfterLong = (Object.keys(DAY_INDEX) as Day[]).find((day) => DAY_INDEX[day] === dayAfterLongIndex);

  if (dayAfterLong && sortedDays.includes(dayAfterLong)) {
    warnings.push(
      `⚠️ Consider leaving ${dayAfterLong} free — recovery after your long run improves adaptation.`,
    );
  }

  let hardGap = -1;
  for (const day of sortedDays) {
    if (day === longRunDay) continue;
    hardGap = Math.max(hardGap, circularDayDistance(day, longRunDay));
  }
  if (hardGap >= 0 && hardGap < 2) {
    warnings.push("⚠️ Your training days are closely spaced. Try to spread them more evenly for better recovery.");
  }

  if (sortedDays.length === 2) {
    warnings.push("ℹ️ With 2 training days, progress will be slower. 3+ days gives better results.");
  }

  if (level === "BEGINNER" && sortedDays.length >= 5) {
    warnings.push(
      "⚠️ 5-6 day plans are recommended for intermediate and advanced runners only. Consider starting with 3-4 days.",
    );
  }

  return warnings;
}

export function assignSessionsTodays(
  days: Day[],
  longRunDay: Day,
  level: PlanConfig["level"],
  config: Pick<PlanConfig, "goal" | "weeks">,
  weekNumber: number,
): Record<Day, RunType> {
  const dayList = daysSorted(uniqDays(days));
  if (!dayList.includes(longRunDay)) {
    throw new Error(`longRunDay ${longRunDay} must be included in training days`);
  }

  const out = Object.fromEntries(dayList.map((day) => [day, "easy"])) as Record<Day, RunType>;
  out[longRunDay] = "long";

  if (dayList.length === 2) {
    const other = dayList.find((d) => d !== longRunDay)!;
    const { isBase, isBuild, isTaper } = getPhaseWindows(config, weekNumber);
    if (isTaper) {
      out[other] = "easy";
      return out;
    }
    if (level === "BEGINNER") {
      out[other] = isBase ? "easy" : "tempo";
      return out;
    }
    // Keep 2-day plans conservative: never interval, always one long + one tempo in non-taper.
    out[other] = isBase || isBuild ? "tempo" : "easy";
    return out;
  }

  const afterLong = dayList.find((day) => (DAY_INDEX[longRunDay] + 1) % 7 === DAY_INDEX[day]);
  if (afterLong) out[afterLong] = "easy";

  const hardType = resolveHardType(
    level,
    { level, goal: config.goal, weeks: config.weeks, days: dayList, longRunDay, vdot: 33 },
    weekNumber,
  );
  let hardDay: Day | null = null;
  let hardGap = -1;
  for (const day of dayList) {
    if (day === longRunDay || day === afterLong) continue;
    const gap = circularDayDistance(day, longRunDay);
    if (gap > hardGap) {
      hardGap = gap;
      hardDay = day;
    }
  }
  if (hardDay) out[hardDay] = hardType;

  return out;
}

function descriptionForSession(type: RunType, phase: Phase, isCutback: boolean): string {
  if (isCutback) {
    if (type === "easy") return "Recovery week. Keep effort very easy.";
    if (type === "long") return "Cutback long run. Lower volume and stay relaxed.";
    if (type === "tempo") return "Cutback week. Controlled effort, don’t push.";
    return "Cutback week. Keep the hard work controlled.";
  }
  if (type === "easy") return "Easy aerobic run. Conversational pace throughout.";
  if (type === "long") {
    if (phase === "Race Specific") return "Progressive long run. Finish feeling strong.";
    return "Base long run. Build time on feet at easy effort.";
  }
  if (type === "tempo") return "Sustained threshold effort. Comfortably hard pace.";
  return "High intensity repeats. Hard effort with recovery.";
}

function getLongRunKm(config: PlanConfig, goal: PlanConfig["goal"]) {
  const key = `${config.level}-${goal}`;
  switch (key) {
    case "BEGINNER-hm": return { start: 7, peak: 18 };
    case "BEGINNER-full": return { start: 10, peak: 29 };
    case "INTERMEDIATE-hm": return { start: 9, peak: 20 };
    case "INTERMEDIATE-full": return { start: 13, peak: 32 };
    case "ADVANCED-hm": return { start: 11, peak: 22 };
    case "ADVANCED-full": return { start: 16, peak: 35 };
    default: return { start: 7, peak: 18 };
  }
}

function buildWeeklyVolumes(config: PlanConfig): { weeklyKm: number[]; isCutback: boolean[]; peakKm: number } {
  const peakKm = getPeakWeeklyKm(config.level, config.goal);
  const adjustedPeakKm = peakKm * (DAY_COUNT_MULTIPLIER[config.days.length] ?? 1.0);
  const peak = round1(adjustedPeakKm);
  const startKm = getStartWeeklyKm(config.level, adjustedPeakKm);
  const { every, reduce, maxIncrease } = getCutbackConfig(config.level);

  // Determine which weeks are taper weeks.
  const taperWeeks = Array.from({ length: config.weeks }, (_, i) => phaseForWeek(config, i + 1) === "Taper");
  const lastNonTaperWeek = taperWeeks.lastIndexOf(false) + 1; // 1-indexed

  const weeklyKm: number[] = [];
  const isCutbackArr: boolean[] = [];

  let prev = startKm;
  for (let w = 1; w <= config.weeks; w++) {
    const phase = phaseForWeek(config, w);

    // Cutbacks are excluded from final 3 weeks (taper block handles reductions).
    const inFinalThree = w > config.weeks - 3;
    const cutback = !inFinalThree && phase !== "Taper" && w % every === 0;
    isCutbackArr.push(cutback);

    if (phase === "Taper") {
      weeklyKm.push(round1(taperWeeklyKm(config, peak, w)));
      continue;
    }

    // Target a smooth ramp to peak by the last non-taper week.
    const progress = lastNonTaperWeek <= 1 ? 1 : (w - 1) / (lastNonTaperWeek - 1);
    const desired = startKm + progress * (peak - startKm);

    const maxAllowed = prev * (1 + maxIncrease);
    let next = Math.min(desired, maxAllowed);

    if (w === 1) next = startKm;
    if (w === lastNonTaperWeek) next = peak;

    if (cutback) next = next * (1 - reduce);

    weeklyKm.push(round1(next));
    prev = next;
  }

  return { weeklyKm, isCutback: isCutbackArr, peakKm: round1(peak) };
}

function buildLongRuns(config: PlanConfig, weeklyKm: number[], isCutback: boolean[]): number[] {
  const { start, peak } = getLongRunKm(config, config.goal);

  // Peak long run should occur at the last non-taper week (before taper starts).
  const lastNonTaperWeek = (() => {
    for (let w = config.weeks; w >= 1; w--) {
      if (phaseForWeek(config, w) !== "Taper") return w;
    }
    return config.weeks;
  })();

  const longKm: number[] = [];
  let curr = start;

  for (let w = 1; w <= config.weeks; w++) {
    const phase = phaseForWeek(config, w);

    if (phase === "Taper") {
      // Reduce proportionally to weekly volume drop vs peak week volume.
      const peakWeekKm = weeklyKm[lastNonTaperWeek - 1] || weeklyKm.find((_, i) => i + 1 === lastNonTaperWeek) || 1;
      const frac = clamp((weeklyKm[w - 1] ?? 0) / Math.max(1, peakWeekKm), 0.3, 1);
      longKm.push(round1(curr * frac));
      continue;
    }

    // Grow toward peak before taper.
    if (w === 1) {
      curr = start;
    } else if (w <= lastNonTaperWeek) {
      const build = phase === "Race Specific";
      if (build) {
        const remainingWeeks = Math.max(1, lastNonTaperWeek - w + 1);
        const remainingDist = peak - curr;
        const ideal = remainingDist / remainingWeeks;
        const inc = clamp(Math.round(ideal), 1, 2);
        curr = Math.min(peak, curr + inc);
      } else {
        // Base phase: gentle increase (0–1 km).
        curr = Math.min(peak, curr + (curr < peak ? 1 : 0));
      }
    }

    let wkLong = curr;
    if (isCutback[w - 1]) {
      const { reduce } = getCutbackConfig(config.level);
      wkLong = wkLong * (1 - reduce);
    }
    longKm.push(round1(wkLong));
  }

  return longKm;
}

export function generatePlan(config: PlanConfig): TrainingWeek[] {
  const days = uniqDays(config.days);
  if (days.length < 2) {
    throw new Error("PlanConfig.days must include at least 2 training days");
  }

  const { weeklyKm, isCutback, peakKm } = buildWeeklyVolumes({ ...config, days });
  const longKm = buildLongRuns({ ...config, days }, weeklyKm, isCutback);

  const paces = getVdotPaces(config.vdot);
  const easyPace = paces.easyMaxSecKm / 60;
  const tempoPace = paces.tempoSecKm / 60;
  const intervalPace = paces.intervalSecKm / 60;
  const longRunPace = (paces.easyMaxSecKm * 1.1) / 60;

  const plan: TrainingWeek[] = [];

  for (let w = 1; w <= config.weeks; w++) {
    const phase = phaseForWeek(config, w);
    const cutback = isCutback[w - 1] ?? false;

    // Week sessions: one per chosen training day.
    const dayList = daysSorted(days);

    const longRunDay = config.longRunDay && dayList.includes(config.longRunDay)
      ? config.longRunDay
      : getDefaultLongRunDay(dayList);
    const typesForWeek = assignSessionsTodays(
      dayList,
      longRunDay,
      config.level,
      { goal: config.goal, weeks: config.weeks },
      w,
    );

    const weekKm = round1(weeklyKm[w - 1] ?? peakKm);
    const baseLongKm = round1(clamp(longKm[w - 1] ?? 0, 5, weekKm));
    const otherDays = dayList.filter((d) => typesForWeek[d] !== "long");
    const nonLongCount = otherDays.length;

    // Rule 1/3: long run should be at least 35% of weekly volume.
    // If base long run would be <35%, reduce weekly volume to match the long run.
    const constrainedWeekKm = round1(Math.min(weekKm, baseLongKm / 0.35));
    const wkLongKm = round1(clamp(Math.max(baseLongKm, constrainedWeekKm * 0.35), 5, constrainedWeekKm));

    // Rule 2: non-long sessions should not exceed 85% of the long run distance.
    // For 4+ day plans, protect easy-day minimums so frequency plans don't degrade into very short runs.
    const easySessionCount = otherDays.filter((day) => typesForWeek[day] === "easy").length;
    const minEasyKm = (
      config.level === "BEGINNER" ? 3 :
      config.level === "INTERMEDIATE" ? 4 :
      5
    );
    const nonLongCap = round1(wkLongKm * 0.85);
    let distributedWeekKm = constrainedWeekKm;
    let remaining = round1(Math.max(0, distributedWeekKm - wkLongKm));
    let eachOther = round1(nonLongCount > 0 ? remaining / nonLongCount : 0);

    if (dayList.length >= 4 && easySessionCount > 0 && eachOther < minEasyKm) {
      const minRequiredWeeklyKm = round1(wkLongKm + (minEasyKm * easySessionCount));
      distributedWeekKm = round1(Math.min(peakKm, Math.max(distributedWeekKm, minRequiredWeeklyKm)));
      remaining = round1(Math.max(0, distributedWeekKm - wkLongKm));
      eachOther = round1(nonLongCount > 0 ? remaining / nonLongCount : 0);
    }

    if (eachOther > nonLongCap) {
      eachOther = nonLongCap;
      distributedWeekKm = round1(wkLongKm + (eachOther * nonLongCount));
    }

    const sessions: Session[] = dayList.map((day) => {
      const type = typesForWeek[day];

      const km =
        type === "long"
          ? wkLongKm
          : round1(clamp(eachOther, 3, Math.max(3, nonLongCap)));

      const pace =
        type === "long" ? longRunPace :
        type === "easy" ? easyPace :
        type === "tempo" ? tempoPace :
        intervalPace;

      return {
        day,
        type,
        targetDistanceKm: round1(km),
        targetPaceMinPerKm: round1(pace),
        description: descriptionForSession(type, phase, cutback),
      };
    });

    plan.push({
      week: w,
      phase,
      isCutback: cutback,
      sessions,
    });
  }

  // Verify no session has a day outside config.days
  const validDays = new Set(days);
  for (const week of plan) {
    for (const session of week.sessions) {
      if (!validDays.has(session.day)) {
        throw new Error(
          `generatePlan produced session for day ${session.day} which is not in config.days ${days.join(",")}`,
        );
      }
    }
  }

  return plan;
}

export function validateAssignments(): void {
  const assertAssignment = (
    name: string,
    actual: Record<Day, RunType>,
    expected: Array<[Day, RunType]>,
  ) => {
    for (const [day, type] of expected) {
      if (actual[day] !== type) {
        throw new Error(`${name} failed: expected ${day}=${type}, got ${day}=${actual[day] ?? "undefined"}`);
      }
    }
  };

  assertAssignment(
    "SCENARIO 1",
    assignSessionsTodays(["mon", "thu"], "thu", "BEGINNER", { goal: "hm", weeks: 12 }, 2),
    [["mon", "easy"], ["thu", "long"]],
  );

  assertAssignment(
    "SCENARIO 2",
    assignSessionsTodays(["tue", "sat"], "sat", "INTERMEDIATE", { goal: "hm", weeks: 16 }, 10),
    [["tue", "tempo"], ["sat", "long"]],
  );

  assertAssignment(
    "SCENARIO 2B",
    assignSessionsTodays(["tue", "sat"], "sat", "BEGINNER", { goal: "hm", weeks: 16 }, 10),
    [["tue", "tempo"], ["sat", "long"]],
  );

  assertAssignment(
    "SCENARIO 2C",
    assignSessionsTodays(["tue", "sat"], "sat", "ADVANCED", { goal: "hm", weeks: 16 }, 10),
    [["tue", "tempo"], ["sat", "long"]],
  );

  assertAssignment(
    "SCENARIO 3",
    assignSessionsTodays(["mon", "wed", "fri", "sun"], "sun", "INTERMEDIATE", { goal: "hm", weeks: 16 }, 10),
    [["mon", "easy"], ["wed", "interval"], ["fri", "easy"], ["sun", "long"]],
  );

  assertAssignment(
    "SCENARIO 4",
    assignSessionsTodays(["mon", "tue", "wed", "fri", "sun"], "sun", "ADVANCED", { goal: "hm", weeks: 16 }, 8),
    [["mon", "easy"], ["tue", "easy"], ["wed", "interval"], ["fri", "easy"], ["sun", "long"]],
  );

  assertAssignment(
    "SCENARIO 5",
    assignSessionsTodays(["mon", "tue", "wed", "thu", "fri", "sat"], "sat", "ADVANCED", { goal: "hm", weeks: 16 }, 10),
    [["mon", "easy"], ["tue", "interval"], ["wed", "easy"], ["thu", "easy"], ["fri", "easy"], ["sat", "long"]],
  );
}

if (process.env.NODE_ENV === "development") {
  validateAssignments();
}

