import type { RunType } from "@/data/trainingPlan";
import { formatPaceMinPerKm, getPacesForVdot } from "@/lib/vdotTables";

export type PlanPhase = "Base" | "Build" | "Peak" | "Taper";

export const QUALITY_WARMUP =
  "15 min easy jog at RPE 3, followed by 4 × 20 sec strides at RPE 8 with 40 sec walk recovery";

export const EASY_WARMUP = "5 min easy jog at RPE 2";

export const ALL_COOLDOWN =
  "10 min very easy jog (RPE 2) followed by static stretching of hamstrings and calves";

export const DYNAMIC_DRILLS =
  "Dynamic drills: A-Skips 2×20m, B-Skips 2×20m, Butt Kicks 2×20m, Leg Swings 15/leg, Walking Lunges 10/leg, Single-Leg Hops 20/leg";

export interface SessionDescriptionParams {
  type: RunType;
  vdot: number;
  phase: PlanPhase;
  level: string;
  goalDistance: string;
  weekNumber: number;
  totalDistanceKm: number;
  isTaperWeek?: boolean;
  /** 5K rep strides — use interval type in Session */
  isReps?: boolean;
  /** Peak goal-pace — use tempo type in Session */
  isRacePace?: boolean;
}

function tempoContinuousMin(vdot: number): number {
  if (vdot <= 40) return 20;
  if (vdot <= 50) return 28;
  return 35;
}

function intervalMainSpec(vdot: number, isTaper: boolean): { structure: string; rest: string } {
  let structure: string;
  let rest: string;
  if (vdot <= 40) {
    structure = "4 × 800m";
    rest = "3 min walking rest";
  } else if (vdot <= 50) {
    structure = "6 × 800m";
    rest = "2 min jogging rest";
  } else {
    structure = "8 × 1000m";
    rest = "90 sec jogging rest";
  }
  if (isTaper) {
    if (structure.startsWith("4 ×")) structure = "2 × 800m";
    else if (structure.startsWith("6 ×")) structure = "3 × 800m";
    else structure = "4 × 1000m";
  }
  return { structure, rest };
}

function repsCount(vdot: number): number {
  if (vdot < 45) return 6;
  if (vdot <= 52) return 8;
  return 10;
}

export function buildSessionDescription(params: SessionDescriptionParams): string {
  const p = getPacesForVdot(params.vdot);
  const e = formatPaceMinPerKm(p.easy);
  const t = formatPaceMinPerKm(p.threshold);
  const i = formatPaceMinPerKm(p.interval);
  const r = formatPaceMinPerKm(p.repetition);
  const m = formatPaceMinPerKm(p.marathon);
  const taperQualityNote =
    params.isTaperWeek === true
      ? " Taper week — volume reduced, intensity maintained. Trust your fitness."
      : "";

  const is10K = params.goalDistance === "10K";
  const cruiseEligible =
    params.type === "tempo" && is10K && (params.phase === "Build" || params.phase === "Peak");

  if (params.type === "easy") {
    return `Warmup: ${EASY_WARMUP}. Run ${params.totalDistanceKm}km at easy effort (RPE 3–4, ${e}/km). Cooldown: ${ALL_COOLDOWN}.`;
  }

  if (params.type === "long") {
    let body = `Warmup: ${EASY_WARMUP}. Long run ${params.totalDistanceKm}km at easy pace (${e}/km), RPE 3–5. Focus on time on feet, not pace. Cooldown: ${ALL_COOLDOWN}.`;
    const adv = params.level === "INTERMEDIATE" || params.level === "ADVANCED";
    if (params.phase === "Peak" && adv) {
      body += ` Final 5km at threshold pace (${t}/km) — fast finish.`;
    }
    return body + taperQualityNote;
  }

  if (params.isRacePace === true && params.type === "tempo") {
    const paceLine = params.goalDistance === "5K" || params.goalDistance === "10K" ? t : m;
    return (
      `Warmup: ${QUALITY_WARMUP}. Main set: ${params.totalDistanceKm}km at goal race pace (${paceLine}/km), RPE 7–8. This is your target finish pace — lock it in neurologically. Cooldown: ${ALL_COOLDOWN}.` +
      taperQualityNote
    );
  }

  if (params.type === "tempo") {
    if (cruiseEligible) {
      const reps = Math.max(1, Math.floor(params.totalDistanceKm / 1.6));
      return (
        `Warmup: ${QUALITY_WARMUP}. ${DYNAMIC_DRILLS}. Main set: 1.6km cruise interval reps at T-pace (${t}/km) with 60 sec rest. Complete ${reps} reps. Cooldown: ${ALL_COOLDOWN}.` +
        taperQualityNote
      );
    }
    const dur = tempoContinuousMin(params.vdot);
    return (
      `Warmup: ${QUALITY_WARMUP}. ${DYNAMIC_DRILLS}. Main set: ${dur}min continuous tempo run at T-pace (${t}/km), RPE 7–8. Cooldown: ${ALL_COOLDOWN}.` +
      taperQualityNote
    );
  }

  if (params.isReps === true && params.type === "interval") {
    const n = repsCount(params.vdot);
    return (
      `Warmup: ${QUALITY_WARMUP}. ${DYNAMIC_DRILLS}. Main set: ${n} × 200m at R-pace (${r}/km), RPE 10. Full recovery between reps (walk 60–90 sec). Focus: turnover and running economy. Cooldown: ${ALL_COOLDOWN}.` +
      taperQualityNote
    );
  }

  if (params.type === "interval") {
    const { structure, rest } = intervalMainSpec(params.vdot, params.isTaperWeek === true);
    return (
      `Warmup: ${QUALITY_WARMUP}. ${DYNAMIC_DRILLS}. Main set: ${structure} at I-pace (${i}/km), RPE 9–10. Rest: ${rest}. Cooldown: ${ALL_COOLDOWN}.` +
      (params.isTaperWeek === true
        ? " Taper week — volume reduced, intensity maintained. Trust your fitness."
        : "")
    );
  }

  return "see session builder";
}

/** Target RPE for session (for plan rows). */
export function targetRpeForSession(params: SessionDescriptionParams): number {
  if (params.type === "easy") return 3;
  if (params.type === "long") return 4;
  if (params.isRacePace) return 8;
  if (params.type === "tempo") return 7;
  if (params.isReps) return 10;
  if (params.type === "interval") return 9;
  return 4;
}

export function estimateSessionDurationMin(
  type: RunType,
  distanceKm: number,
  paceSecondsPerKm: number,
  vdot: number,
  opts?: { isReps?: boolean; isCruiseTempo?: boolean; cruiseReps?: number; isTaperInterval?: boolean },
): number {
  const qualityOverhead = 25;
  const easyOverhead = 15;

  if (type === "interval" && opts?.isReps) {
    const repKm = 0.2;
    const n = repsCount(vdot);
    const repMin = (repKm * paceSecondsPerKm) / 60;
    const walkMin = ((n - 1) * 75) / 60;
    return n * repMin + walkMin + qualityOverhead;
  }

  if (type === "interval") {
    const isTaper = opts?.isTaperInterval === true;
    let reps: number;
    let repKm: number;
    let restMinPerRep: number;
    if (vdot <= 40) {
      reps = isTaper ? 2 : 4;
      repKm = 0.8;
      restMinPerRep = 3;
    } else if (vdot <= 50) {
      reps = isTaper ? 3 : 6;
      repKm = 0.8;
      restMinPerRep = 2;
    } else {
      reps = isTaper ? 4 : 8;
      repKm = 1.0;
      restMinPerRep = 1.5;
    }
    const repMin = (repKm * paceSecondsPerKm) / 60;
    return reps * repMin + Math.max(0, reps - 1) * restMinPerRep + qualityOverhead;
  }

  if (type === "tempo" && opts?.isCruiseTempo && opts.cruiseReps != null) {
    const repKm = 1.6;
    const n = opts.cruiseReps;
    const repMin = (repKm * paceSecondsPerKm) / 60;
    return n * repMin + (n - 1) * 1 + qualityOverhead;
  }

  if (type === "tempo") {
    const dur = tempoContinuousMin(vdot);
    return dur + qualityOverhead;
  }

  const runMin = (distanceKm * paceSecondsPerKm) / 60;
  const overhead = type === "easy" || type === "long" ? easyOverhead : qualityOverhead;
  return runMin + overhead;
}
