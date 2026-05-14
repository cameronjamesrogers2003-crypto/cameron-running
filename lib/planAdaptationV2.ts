import type { RunType, TrainingWeek } from "@/data/trainingPlan";
import { checkAcwr } from "@/lib/generatePlanV2";
import type { PlanConfigV2 } from "@/lib/generatePlanV2";
import { buildSessionDescription, type PlanPhase } from "@/lib/sessionBuilderV2";
import { formatPaceMinPerKm, getPacesForVdot, secondsPerKmToMinPerKm } from "@/lib/vdotTables";
import { roundProgramDistanceKm } from "@/lib/planDistanceKm";

export interface AdaptationSignals {
  missedSessions: number;
  rpeLastSession?: number;
  rpeTarget?: number;
  paceActualSecondsPerKm?: number;
  paceTargetSecondsPerKm?: number;
  hrActual?: number;
  hrExpected?: number;
  injuryFlagged: boolean;
  strongPerformance: boolean;
  currentWeekIndex: number;
  vdot: number;
}

export function weekTotalKm(week: TrainingWeek): number {
  const sum = week.sessions.reduce((s, x) => s + x.targetDistanceKm, 0);
  return roundProgramDistanceKm(sum);
}

function cloneWeeks(plan: TrainingWeek[]): TrainingWeek[] {
  return plan.map((w) => ({
    ...w,
    sessions: w.sessions.map((s) => ({ ...s })),
  }));
}

function planPhaseFromWeek(w: TrainingWeek): PlanPhase {
  const p = w.phase as string;
  if (p === "Base" || p === "Build" || p === "Peak" || p === "Taper") return p;
  return "Base";
}

function paceMinFromSeconds(sec: number): number {
  return secondsPerKmToMinPerKm(sec);
}

function applyVdotToWeekSessions(
  week: TrainingWeek,
  vdot: number,
  goalDistance: PlanConfigV2["goalDistance"],
  level: string,
): TrainingWeek {
  const paces = getPacesForVdot(vdot);
  const phase = planPhaseFromWeek(week);
  return {
    ...week,
    sessions: week.sessions.map((s) => {
      const isReps = s.description.includes("× 200m") && s.description.includes("R-pace");
      const isRacePace =
        s.description.includes("goal race pace") || s.description.includes("target finish pace");
      const paceSec =
        s.type === "easy" || s.type === "long"
          ? paces.easy
          : s.type === "tempo" && isRacePace
            ? goalDistance === "5K" || goalDistance === "10K"
              ? paces.threshold
              : paces.marathon
            : s.type === "tempo"
              ? paces.threshold
              : s.type === "interval" && isReps
                ? paces.repetition
                : paces.interval;
      const paceMin = paceMinFromSeconds(paceSec);
      const desc = buildSessionDescription({
        type: s.type,
        vdot,
        phase,
        level,
        goalDistance,
        weekNumber: week.week,
        totalDistanceKm: s.targetDistanceKm,
        isTaperWeek: phase === "Taper",
        isReps: isReps && s.type === "interval",
        isRacePace: isRacePace && s.type === "tempo",
      });
      return {
        ...s,
        targetPaceMinPerKm: paceMin,
        targetPaceFormatted: formatPaceMinPerKm(paceSec),
        description: desc,
      };
    }),
  };
}

/**
 * Apply adaptation priority rules to a copy of the plan.
 * Optional meta is used when VDOT-based redescription runs (goal + level).
 */
export function applyAdaptationSignals(
  plan: TrainingWeek[],
  signals: AdaptationSignals,
  meta?: { goalDistance?: PlanConfigV2["goalDistance"]; experienceLevel?: string },
): TrainingWeek[] {
  const goalDistance = meta?.goalDistance ?? "10K";
  const level = meta?.experienceLevel ?? "INTERMEDIATE";
  let out = cloneWeeks(plan);
  const cw = signals.currentWeekIndex;
  const cur = out[cw];
  if (!cur) return out;

  if (signals.injuryFlagged) {
    out = out.map((week, wi) => {
      if (wi < cw) return week;
      return {
        ...week,
        sessions: week.sessions.map((s) => {
          if (s.type === "tempo" || s.type === "interval") {
            const inj = "Injury protocol: easy effort only. No quality work for 7 days.";
            return {
              ...s,
              type: "easy" as RunType,
              description: `${s.description} ${inj}`,
            };
          }
          return s;
        }),
      };
    });
  }

  if (signals.missedSessions >= 3 && cw > 0) {
    const prevWeek = out[cw - 1]!;
    const prevTotal = weekTotalKm(prevWeek);
    const curTotal = weekTotalKm(cur);
    if (curTotal > 0 && prevTotal > 0) {
      const scale = prevTotal / curTotal;
      out[cw] = {
        ...cur,
        sessions: cur.sessions.map((s) => ({
          ...s,
          targetDistanceKm: Math.max(0.25, roundProgramDistanceKm(s.targetDistanceKm * scale)),
        })),
      };
    }
  }

  if (
    signals.rpeLastSession != null &&
    signals.rpeTarget != null &&
    signals.rpeLastSession > signals.rpeTarget + 3
  ) {
    const vdotAdj = signals.vdot - 1;
    const end = Math.min(out.length - 1, cw + 1);
    for (let wi = cw; wi <= end; wi++) {
      const w = out[wi];
      if (!w) continue;
      out[wi] = applyVdotToWeekSessions(w, vdotAdj, goalDistance, level);
      out[wi] = {
        ...out[wi]!,
        sessions: out[wi]!.sessions.map((s) => ({
          ...s,
          description: `${s.description} VDOT temporarily reduced by 1pt — paces adjusted.`,
        })),
      };
    }
  }

  if (
    signals.paceActualSecondsPerKm != null &&
    signals.paceTargetSecondsPerKm != null &&
    signals.paceActualSecondsPerKm > signals.paceTargetSecondsPerKm * 1.1
  ) {
    let found = false;
    out = out.map((week, wi) => {
      if (found || wi < cw) return week;
      return {
        ...week,
        sessions: week.sessions.map((s) => {
          if (found) return s;
          if (s.type === "tempo" || s.type === "interval") {
            found = true;
            return {
              ...s,
              description: `${s.description} Pace review recommended — consider a 1.6km time trial to rebase VDOT.`,
            };
          }
          return s;
        }),
      };
    });
  }

  if (
    signals.hrActual != null &&
    signals.hrExpected != null &&
    signals.hrActual > signals.hrExpected * 1.1
  ) {
    let count = 0;
    out = out.map((week, wi) => {
      if (wi < cw) return week;
      return {
        ...week,
        sessions: week.sessions.map((s) => {
          if (count >= 3) return s;
          count += 1;
          const x = signals.rpeTarget ?? 5;
          return {
            ...s,
            description: `${s.description} HR elevated — run by feel (RPE ${x}) rather than pace today.`,
          };
        }),
      };
    });
  }

  if (signals.missedSessions === 1 && cur.sessions.length > 1) {
    out[cw] = {
      ...cur,
      sessions: cur.sessions.slice(0, -1),
    };
  }

  if (signals.strongPerformance) {
    const vdotAdj = signals.vdot + 0.5;
    for (let wi = cw + 1; wi < out.length; wi++) {
      const w = out[wi];
      if (!w) continue;
      out[wi] = applyVdotToWeekSessions(w, vdotAdj, goalDistance, level);
    }
  }

  return out;
}

export function getAcwrStatus(
  plan: TrainingWeek[],
  currentWeekIndex: number,
): { acwr: number; safe: boolean; recommendation: string } {
  if (currentWeekIndex < 0 || currentWeekIndex >= plan.length) {
    return { acwr: 0, safe: true, recommendation: "" };
  }
  const current = weekTotalKm(plan[currentWeekIndex]!);
  const prev: number[] = [];
  for (let i = Math.max(0, currentWeekIndex - 4); i < currentWeekIndex; i++) {
    prev.push(weekTotalKm(plan[i]!));
  }
  const { acwr, safe } = checkAcwr(current, prev);
  let recommendation = "";
  if (!safe || acwr > 1.5) {
    recommendation =
      "Your acute-to-chronic workload ratio is elevated. Hold volume steady for one week, prioritise sleep and easy running, and avoid adding new intensity until the ratio settles.";
  }
  return { acwr, safe: acwr <= 1.5, recommendation };
}
