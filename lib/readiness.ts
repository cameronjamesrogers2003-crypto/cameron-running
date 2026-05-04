import type { TrainingWeek } from "@/data/trainingPlan";
import { getEffectivePlanStart, getSessionDate, isActivityOnOrAfterPlanStart } from "@/lib/planUtils";
import { startOfDayAEST, startOfNextDayAEST, toAEST, toBrisbaneYmd } from "@/lib/dateUtils";
import { inferRunType, type StatActivity } from "@/lib/rating";
import type { UserSettings } from "@/lib/settings";
import { DEFAULT_SETTINGS } from "@/lib/settings";
import { TARGET_HM_PACE, STARTING_TEMPO_PACE } from "@/lib/constants";

export interface RunnerRatingResult {
  total: number;
  consistency: number;
  progress: number;
  longRuns: number;
  injuryFree: number;
  extras: number;
  injuryFreeWeeks: number;
}

export interface HMReadinessResult {
  total: number;
  pace: number;
  consistency: number;
  longRun: number;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function storedRating(r: StatActivity): number | null {
  const x = r.rating;
  return typeof x === "number" && !Number.isNaN(x) ? x : null;
}

export function calculateRunnerRating(
  runs: StatActivity[],
  plan: TrainingWeek[],
  settings: UserSettings = DEFAULT_SETTINGS,
  _pbPaceSecKm?: number | null,
  referenceDate?: Date
): RunnerRatingResult {
  const today         = referenceDate ?? new Date();
  const todayMidnight = startOfDayAEST(today);
  const MS            = 24 * 60 * 60 * 1000;
  const planStart     = getEffectivePlanStart(settings.planStartDate);

  const past28 = new Date(todayMidnight.getTime() - 28 * MS);
  const past42 = new Date(todayMidnight.getTime() - 42 * MS);

  const planDates4     = new Set<string>();
  const planLongDates6 = new Set<string>();
  const planDates6     = new Set<string>();

  for (const planWeek of plan) {
    for (const session of planWeek.sessions) {
      const sd = getSessionDate(planWeek.week, session.day, planStart);
      if (toBrisbaneYmd(sd) > toBrisbaneYmd(today)) continue;
      const key = toBrisbaneYmd(sd);
      if (sd >= past28) planDates4.add(key);
      if (sd >= past42) {
        planDates6.add(key);
        if (session.type === "long") planLongDates6.add(key);
      }
    }
  }

  function runKey(r: StatActivity) { return toBrisbaneYmd(new Date(r.date)); }

  const todayEnd = startOfNextDayAEST(today);
  const pastRuns   = runs.filter(r => new Date(r.date) < todayEnd);
  const runsLast28 = pastRuns.filter(r => new Date(r.date) >= past28);
  const runsLast42 = pastRuns.filter(r => new Date(r.date) >= past42);
  const runKeys28  = new Set(
    runsLast28
      .filter((r) => isActivityOnOrAfterPlanStart(new Date(r.date), planStart))
      .map(runKey),
  );
  const runKeys42  = new Set(
    runsLast42
      .filter((r) => isActivityOnOrAfterPlanStart(new Date(r.date), planStart))
      .map(runKey),
  );

  // -- Consistency ----------------------------------------------------------
  let completedLast4Weeks = 0;
  for (const k of planDates4) { if (runKeys28.has(k)) completedLast4Weeks++; }
  const allWeeksComplete = planDates4.size >= 12 && completedLast4Weeks === planDates4.size;
  const consistencyScore = clamp((completedLast4Weeks / 12) * 20 + (allWeeksComplete ? 1 : 0), 0, 20);

  // -- Progress (stored per-activity ratings only) -------------------------
  const byDateDesc = [...pastRuns].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const last4Runs  = byDateDesc.slice(0, 4);
  const prior4Runs = byDateDesc.slice(4, 8);

  function avgStored(rs: StatActivity[]): number {
    if (!rs.length) return 5;
    const vals = rs.map(storedRating).filter((v): v is number => v != null);
    if (!vals.length) return 5;
    return vals.reduce((s, v) => s + v, 0) / vals.length;
  }

  const progressScore = clamp(10 + (avgStored(last4Runs) - avgStored(prior4Runs)) * 5, 0, 20);

  // -- Long runs ------------------------------------------------------------
  let completedLong = 0;
  for (const k of planLongDates6) { if (runKeys42.has(k)) completedLong++; }
  const longRunScore = planLongDates6.size > 0
    ? clamp((completedLong / planLongDates6.size) * 25, 0, 25)
    : 12.5;

  // -- Injury-free ----------------------------------------------------------
  const DAY_ORDER: Record<string, number> = { sat: 0, sun: 1, wed: 2 };
  type SS = { weekNum: number; done: boolean };
  const sessionList: SS[] = [];

  for (const planWeek of plan) {
    const sorted = [...planWeek.sessions].sort((a, b) => DAY_ORDER[a.day] - DAY_ORDER[b.day]);
    for (const session of sorted) {
      const sd = getSessionDate(planWeek.week, session.day, planStart);
      if (sd >= todayMidnight) continue;
      sessionList.push({
        weekNum: planWeek.week,
        done: pastRuns.some((r) => {
          const rd = new Date(r.date);
          return (
            isActivityOnOrAfterPlanStart(rd, planStart)
            && toBrisbaneYmd(rd) === toBrisbaneYmd(sd)
          );
        }),
      });
    }
  }

  let breakAtWeek = 0;
  for (let i = sessionList.length - 1; i > 0; i--) {
    if (!sessionList[i].done && !sessionList[i - 1].done) {
      breakAtWeek = sessionList[i].weekNum;
      break;
    }
  }

  let injuryFreeWeeks = 0;
  if (breakAtWeek === 0) {
    injuryFreeWeeks = new Set(sessionList.map(s => s.weekNum)).size;
  } else {
    injuryFreeWeeks = new Set(sessionList.filter(s => s.weekNum > breakAtWeek).map(s => s.weekNum)).size;
  }

  const injuryFreeScore = clamp((injuryFreeWeeks / 8) * 20, 0, 20);

  // -- Extras ---------------------------------------------------------------
  const PLAN_DOW = new Set([0, 3, 6]);
  const extraRunsLast4Weeks = runsLast28.filter(r => !PLAN_DOW.has(toAEST(new Date(r.date)).getUTCDay())).length;
  const extrasScore = clamp(extraRunsLast4Weeks * 2.5, 0, 15);

  const total = Math.min(100, Math.round(consistencyScore + progressScore + longRunScore + injuryFreeScore + extrasScore));

  return {
    total,
    consistency:    round1(consistencyScore),
    progress:       round1(progressScore),
    longRuns:       round1(longRunScore),
    injuryFree:     round1(injuryFreeScore),
    extras:         round1(extrasScore),
    injuryFreeWeeks,
  };
}

export function calculateHMReadiness(
  runs: StatActivity[],
  plan: TrainingWeek[],
  settings: UserSettings = DEFAULT_SETTINGS
): HMReadinessResult {
  const planStart = getEffectivePlanStart(settings.planStartDate);
  const targetPaceSec   = settings.targetHMTimeSec / 21.0975;
  const targetPaceMinKm = targetPaceSec / 60;
  const startingPace    = settings.startingTempoPaceSec / 60;
  const targetPace      = isFinite(targetPaceMinKm) ? targetPaceMinKm : TARGET_HM_PACE;
  const startPace       = startingPace > 0 ? startingPace : STARTING_TEMPO_PACE;

  const today         = new Date();
  const todayMidnight = startOfDayAEST(today);
  const todayEnd      = startOfNextDayAEST(today);
  const past42        = new Date(todayMidnight.getTime() - 42 * 24 * 60 * 60 * 1000);
  const pastRuns      = runs.filter(r => new Date(r.date) < todayEnd && new Date(r.date) >= past42);

  // -- Pace readiness -------------------------------------------------------
  const tempoRuns = pastRuns
    .filter(r => inferRunType(r, settings) === "tempo")
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 3);

  let paceReadiness = 0;
  if (tempoRuns.length > 0) {
    const avgPace = tempoRuns.reduce((s, r) => s + r.avgPaceSecKm / 60, 0) / tempoRuns.length;
    paceReadiness = clamp((startPace - avgPace) / (startPace - targetPace), 0, 1);
  }

  // -- Consistency readiness ------------------------------------------------
  const planDates6 = new Set<string>();
  for (const planWeek of plan) {
    for (const session of planWeek.sessions) {
      const sd = getSessionDate(planWeek.week, session.day, planStart);
      if (sd < todayEnd && sd >= past42) planDates6.add(toBrisbaneYmd(sd));
    }
  }

  let completed6 = 0;
  for (const k of planDates6) {
    if (
      pastRuns.some((r) => {
        const rd = new Date(r.date);
        return isActivityOnOrAfterPlanStart(rd, planStart) && toBrisbaneYmd(rd) === k;
      })
    ) {
      completed6++;
    }
  }
  const consistencyReadiness = planDates6.size > 0 ? clamp(completed6 / planDates6.size, 0, 1) : 0;

  // -- Long run readiness ---------------------------------------------------
  const longestRun      = pastRuns.reduce((m, r) => Math.max(m, r.distanceKm), 0);
  const longRunReadiness = clamp(longestRun / 21, 0, 1);

  const total = Math.round(((paceReadiness + consistencyReadiness + longRunReadiness) / 3) * 100);

  return {
    total,
    pace:        Math.round(paceReadiness * 100),
    consistency: Math.round(consistencyReadiness * 100),
    longRun:     Math.round(longRunReadiness * 100),
  };
}
