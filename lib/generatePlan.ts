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

function dayDistance(a: Day, b: Day): number {
  const da = DAY_INDEX[a];
  const db = DAY_INDEX[b];
  return Math.abs(da - db);
}

function nearestTrainingDayDistance(day: Day, trainingSet: Set<Day>): number {
  // distance in days to closest other training day (0 if none / self only)
  if (trainingSet.size <= 1) return 0;
  let best = 7;
  for (const d of trainingSet) {
    if (d === day) continue;
    const raw = Math.abs(DAY_INDEX[d] - DAY_INDEX[day]);
    // wrap-around week distance
    const dist = Math.min(raw, 7 - raw);
    best = Math.min(best, dist);
  }
  return best === 7 ? 0 : best;
}

function restNeighborsScore(day: Day, trainingSet: Set<Day>): number {
  // how much rest surrounds the day (consecutive non-training days on both sides)
  const idx = DAY_INDEX[day];
  let before = 0;
  for (let i = 1; i <= 6; i++) {
    const d = Object.keys(DAY_INDEX).find((k) => DAY_INDEX[k as Day] === (idx - i + 7) % 7) as Day;
    if (trainingSet.has(d)) break;
    before++;
  }
  let after = 0;
  for (let i = 1; i <= 6; i++) {
    const d = Object.keys(DAY_INDEX).find((k) => DAY_INDEX[k as Day] === (idx + i) % 7) as Day;
    if (trainingSet.has(d)) break;
    after++;
  }
  return before + after;
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

function chooseSessionAssignment(config: PlanConfig): Record<Day, RunType> {
  const days = uniqDays(config.days);
  const trainingSet = new Set(days);

  // Two-day rule override.
  if (days.length === 2) {
    const sorted = daysSorted(days);
    // Prefer existing assignment where possible.
    const provided0 = config.sessionAssignment?.[sorted[0]];
    const provided1 = config.sessionAssignment?.[sorted[1]];
    const out: Record<Day, RunType> = {} as Record<Day, RunType>;

    const beginner = config.level === "BEGINNER";
    const secondType: RunType = beginner ? "easy" : "tempo";

    // Ensure exactly one long.
    if (provided0 === "long" || provided1 === "long") {
      out[sorted[0]] = provided0 === "long" ? "long" : secondType;
      out[sorted[1]] = provided1 === "long" ? "long" : secondType;
    } else {
      // Put long on the day with more surrounding rest.
      const longDay = restNeighborsScore(sorted[0], trainingSet) >= restNeighborsScore(sorted[1], trainingSet)
        ? sorted[0]
        : sorted[1];
      out[longDay] = "long";
      out[longDay === sorted[0] ? sorted[1] : sorted[0]] = secondType;
    }

    // No intervals on 2-day plans.
    for (const d of sorted) {
      if (out[d] === "interval") out[d] = secondType;
    }
    return out;
  }

  // Start with whatever was provided (only for chosen days).
  const out: Partial<Record<Day, RunType>> = {};
  for (const d of days) {
    const t = config.sessionAssignment?.[d];
    if (t === "easy" || t === "tempo" || t === "interval" || t === "long") out[d] = t;
  }

  // Fallback algorithm to fill gaps.
  const missing = days.filter((d) => !out[d]);
  if (missing.length > 0) {
    // 1) Long on day with most rest around it.
    if (!Object.values(out).includes("long")) {
      let best = days[0];
      for (const d of days) {
        if (restNeighborsScore(d, trainingSet) > restNeighborsScore(best, trainingSet)) best = d;
      }
      out[best] = "long";
    }

    // 2) Interval (or Tempo for beginners) far from long (48h+).
    const longDay = days.find((d) => out[d] === "long")!;
    const beginner = config.level === "BEGINNER";
    const hard1: RunType = beginner ? "tempo" : "interval";
    if (!Object.values(out).includes(hard1)) {
      const candidates = days
        .filter((d) => !out[d])
        .filter((d) => nearestTrainingDayDistance(d, new Set([longDay])) >= 2)
        .sort((a, b) => dayDistance(b, longDay) - dayDistance(a, longDay));
      if (candidates[0]) out[candidates[0]] = hard1;
    }

    // 3) Tempo far from interval/hard1.
    if (!Object.values(out).includes("tempo")) {
      const hardDay = days.find((d) => out[d] === "interval" || out[d] === "tempo");
      const candidates = days
        .filter((d) => !out[d])
        .filter((d) => !hardDay || nearestTrainingDayDistance(d, new Set([hardDay])) >= 2)
        .sort((a, b) => (hardDay ? dayDistance(b, hardDay) - dayDistance(a, hardDay) : 0));
      if (candidates[0]) out[candidates[0]] = "tempo";
    }

    // Remaining => easy.
    for (const d of days) {
      if (!out[d]) out[d] = "easy";
    }
  }

  // Enforce no consecutive hard sessions.
  const sorted = daysSorted(days);
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    if (Math.abs(DAY_INDEX[curr] - DAY_INDEX[prev]) === 1) {
      const pt = out[prev]!;
      const ct = out[curr]!;
      if (isHard(pt) && isHard(ct)) {
        out[curr] = "easy";
      }
    }
  }

  // Ensure only one long.
  const longs = days.filter((d) => out[d] === "long");
  if (longs.length > 1) {
    // keep the best rest-scored day as long, downgrade others to easy
    let keep = longs[0];
    for (const d of longs) {
      if (restNeighborsScore(d, trainingSet) > restNeighborsScore(keep, trainingSet)) keep = d;
    }
    for (const d of longs) {
      if (d !== keep) out[d] = "easy";
    }
  }
  if (longs.length === 0) {
    let best = days[0];
    for (const d of days) {
      if (restNeighborsScore(d, trainingSet) > restNeighborsScore(best, trainingSet)) best = d;
    }
    out[best] = "long";
  }

  return out as Record<Day, RunType>;
}

export function recommendSessionAssignment(
  level: PlanConfig["level"],
  days: Day[],
  current: Partial<Record<Day, RunType>> = {},
): Record<Day, RunType> {
  const normalizedDays = uniqDays(days);
  return chooseSessionAssignment({
    level,
    goal: "hm",
    weeks: 16,
    days: normalizedDays,
    sessionAssignment: current as Record<Day, RunType>,
    vdot: 33,
  });
}

function gateSessionType(
  config: PlanConfig,
  type: RunType,
  week: number,
  phase: Phase,
): RunType {
  const beginner = config.level === "BEGINNER";
  const intermediate = config.level === "INTERMEDIATE";
  const advanced = config.level === "ADVANCED";

  const buildWeeksStart = (() => {
    for (let w = 1; w <= config.weeks; w++) {
      if (phaseForWeek(config, w) === "Race Specific") return w;
    }
    return 1;
  })();

  // 2-day plans never use intervals.
  if (config.days.length === 2 && type === "interval") return beginner ? "easy" : "tempo";

  if (beginner) {
    // Base phase: easy + long only.
    if (phase === "Beginner Base" || phase === "Base") {
      return type === "long" ? "long" : "easy";
    }
    // Tempo intro week: week 7 of a 16-week plan, proportionally for 12/20.
    const tempoIntro = Math.max(2, Math.round((7 / 16) * config.weeks));
    if (week < tempoIntro) {
      return type === "long" ? "long" : "easy";
    }
    // Intervals not until build phase week 3+.
    const intervalAllowedWeek = buildWeeksStart + 2;
    if (type === "interval" && week < intervalAllowedWeek) return "tempo";
    return type;
  }

  if (intermediate) {
    // Week 1: easy + long only.
    if (week === 1) return type === "long" ? "long" : "easy";
    // Week 2+: tempo introduced (but intervals wait for build phase).
    if (type === "interval" && phase !== "Race Specific") return "tempo";
    if (type === "interval" && phase === "Race Specific") return "interval";
    return type;
  }

  // advanced
  if (advanced) return type;

  return type;
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
  const peak = getPeakWeeklyKm(config.level, config.goal);
  const startKm = getStartWeeklyKm(config.level, peak);
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

  return { weeklyKm, isCutback: isCutbackArr, peakKm: peak };
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

  const assignment = chooseSessionAssignment({ ...config, days });
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

    // Determine the actual session types for this week after gating rules.
    const typesForWeek: Record<Day, RunType> = {} as Record<Day, RunType>;
    for (const d of dayList) {
      const raw = assignment[d] ?? "easy";
      typesForWeek[d] = gateSessionType(config, raw, w, phase);
    }

    // Ensure no consecutive hard sessions after gating (downgrade later one).
    for (let i = 1; i < dayList.length; i++) {
      const prev = dayList[i - 1];
      const curr = dayList[i];
      if (Math.abs(DAY_INDEX[curr] - DAY_INDEX[prev]) === 1) {
        if (isHard(typesForWeek[prev]) && isHard(typesForWeek[curr])) {
          typesForWeek[curr] = "easy";
        }
      }
    }

    const weekKm = weeklyKm[w - 1] ?? peakKm;
    const longDay = dayList.find((d) => typesForWeek[d] === "long") ?? dayList[0];
    const baseLongKm = clamp(longKm[w - 1] ?? 0, 5, weekKm);
    // If long run is <30% of weekly load, reduce weekly load proportionally.
    // This prevents non-long sessions from dwarfing the long run.
    const adjustedWeekKm = baseLongKm < weekKm * 0.30
      ? baseLongKm / 0.30
      : weekKm;
    const wkLongKm = clamp(baseLongKm, 5, adjustedWeekKm);

    const otherDays = dayList.filter((d) => d !== longDay);
    const remaining = Math.max(0, adjustedWeekKm - wkLongKm);
    const eachOther = otherDays.length > 0 ? remaining / otherDays.length : 0;

    const sessions: Session[] = dayList.map((day) => {
      const type = day === longDay ? "long" : typesForWeek[day];

      const km =
        day === longDay
          ? wkLongKm
          : clamp(eachOther, 3, Math.max(3, adjustedWeekKm - wkLongKm));

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

  return plan;
}

