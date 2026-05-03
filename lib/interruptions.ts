import type { TrainingWeek, Session } from "@/data/trainingPlan";
import { PACE_ZONES } from "@/data/trainingPlan";
import { PLAN_START_DATE } from "@/lib/planUtils";

export type InterruptionType = "break" | "reduced_load" | "illness" | "injury";

export interface PlanInterruption {
  id: string;
  reason: string;
  type: InterruptionType;
  startDate: Date;
  endDate: Date | null;
  weeklyKmEstimate: number | null;
  notes: string | null;
  weeksAffected: number | null;
  createdAt?: Date;
}

export const INTERRUPTION_TYPE_LABEL: Record<InterruptionType, string> = {
  break:        "Training break",
  reduced_load: "Reduced load",
  illness:      "Illness",
  injury:       "Injury",
};

export function getWeeksOff(interruption: PlanInterruption): number {
  if (interruption.weeksAffected != null) return Math.max(0, interruption.weeksAffected);
  if (!interruption.endDate) return 0;
  const ms = interruption.endDate.getTime() - interruption.startDate.getTime();
  return Math.max(0, Math.ceil(ms / (7 * 24 * 60 * 60 * 1000)));
}

// VO2max drops ~6% at 4w, ~10% at 5-6w, ~14% at 7-8w, up to 28% capped.
// Beginners lose fitness 1.2× faster than trained athletes.
function recoveryWeeksNeeded(effectiveWeeksOff: number): number {
  if (effectiveWeeksOff < 2) return 0;
  if (effectiveWeeksOff < 4) return 1;
  if (effectiveWeeksOff < 5) return 2;
  if (effectiveWeeksOff < 7) return 3;
  return 4;
}

function calcEffectiveWeeksOff(
  interruption: PlanInterruption,
  normalWeeklyKm: number,
  isBeginnerCurve: boolean,
): number {
  const raw = getWeeksOff(interruption);
  let effective = raw;

  if (
    interruption.type === "reduced_load" &&
    interruption.weeklyKmEstimate != null &&
    normalWeeklyKm > 0
  ) {
    const loadRatio = Math.max(0, 1 - interruption.weeklyKmEstimate / normalWeeklyKm);
    effective = raw * loadRatio;
  }

  if (isBeginnerCurve) effective *= 1.2;
  return effective;
}

function buildRecoveryWeek(
  weekNumber: number,
  referenceWeek: TrainingWeek,
  recoveryIndex: number,
): TrainingWeek {
  const volumeFractions = [0.40, 0.60, 0.75, 0.90];
  const frac = volumeFractions[Math.min(recoveryIndex, volumeFractions.length - 1)];

  const sessions: Session[] = referenceWeek.sessions.map(s => {
    const km = Math.max(3, Math.round(s.targetDistanceKm * frac * 10) / 10);
    return {
      day: s.day,
      type: "easy" as const,
      targetDistanceKm: km,
      targetPaceMinPerKm: PACE_ZONES.easy,
      description: `${km} km easy (return to running)`,
    };
  });

  return {
    week: weekNumber,
    phase: "Recovery",
    isCutback: false,
    isRecovery: true,
    sessions,
  };
}

export interface ReconfigureResult {
  plan: TrainingWeek[];
  totalWeeksAdded: number;
  adjustmentSummary: string[];
  extendsPastRace: boolean;
}

export function reconfigurePlan(
  basePlan: TrainingWeek[],
  interruptions: PlanInterruption[],
  options: {
    isBeginnerCurve?: boolean;
    raceDate?: Date | null;
    normalWeeklyKm?: number;
  } = {},
): ReconfigureResult {
  const { isBeginnerCurve = true, raceDate = null, normalWeeklyKm = 35 } = options;

  const active = interruptions.filter(i => getWeeksOff(i) > 0);

  function checkRace(plan: TrainingWeek[]): boolean {
    if (!raceDate) return false;
    const last = plan[plan.length - 1];
    if (!last) return false;
    const planEndMs = PLAN_START_DATE.getTime() + last.week * 7 * 24 * 60 * 60 * 1000;
    return planEndMs > raceDate.getTime();
  }

  if (!active.length) {
    return {
      plan: basePlan,
      totalWeeksAdded: 0,
      adjustmentSummary: [],
      extendsPastRace: checkRace(basePlan),
    };
  }

  const sorted = [...active].sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
  let plan: TrainingWeek[] = basePlan.map(w => ({ ...w, sessions: [...w.sessions] }));
  const adjustmentSummary: string[] = [];
  let totalWeeksAdded = 0;

  for (const interruption of sorted) {
    const eff = calcEffectiveWeeksOff(interruption, normalWeeklyKm, isBeginnerCurve);
    const recoveryR = recoveryWeeksNeeded(eff);
    if (recoveryR === 0) continue;

    const diffMs = interruption.startDate.getTime() - PLAN_START_DATE.getTime();
    const daysIn = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const interruptionWeek = daysIn < 0 ? 1 : Math.floor(daysIn / 7) + 1;
    const rawOff = getWeeksOff(interruption);
    const resumeWeek = interruptionWeek + rawOff;

    const insertIdx = plan.findIndex(w => w.week >= resumeWeek);
    const refWeekIdx = insertIdx === -1 ? plan.length - 1 : Math.max(0, insertIdx);
    const referenceWeek = plan[refWeekIdx];

    if (insertIdx === -1) {
      const lastWeekNum = plan[plan.length - 1]?.week ?? 18;
      for (let r = 0; r < recoveryR; r++) {
        plan.push(buildRecoveryWeek(lastWeekNum + r + 1, referenceWeek, r));
      }
    } else {
      for (let i = insertIdx; i < plan.length; i++) {
        plan[i] = {
          ...plan[i],
          week: plan[i].week + recoveryR,
          originalWeek: plan[i].originalWeek ?? plan[i].week,
        };
      }
      const recoveryWeeks: TrainingWeek[] = [];
      for (let r = 0; r < recoveryR; r++) {
        recoveryWeeks.push(buildRecoveryWeek(resumeWeek + r, referenceWeek, r));
      }
      plan.splice(insertIdx, 0, ...recoveryWeeks);
    }

    totalWeeksAdded += recoveryR;
    const offLabel = rawOff === 1 ? "1 week" : `${rawOff} weeks`;
    const recLabel = recoveryR === 1 ? "1 recovery week" : `${recoveryR} recovery weeks`;
    adjustmentSummary.push(
      `${INTERRUPTION_TYPE_LABEL[interruption.type]} — ${offLabel} off → ${recLabel} added`
    );
  }

  return { plan, totalWeeksAdded, adjustmentSummary, extendsPastRace: checkRace(plan) };
}
