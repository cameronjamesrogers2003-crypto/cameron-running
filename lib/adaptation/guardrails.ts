export interface SessionPatch {
  scheduledSessionId: string;
  changes: {
    distanceKm?: number;
    sessionType?: string;
    targetPaceMinKmLow?: number;
    targetPaceMinKmHigh?: number;
    targetHrZone?: number;
    notes?: string;
  };
  rationale: string;
}

export interface GuardrailContext {
  originalDistanceKm: number;
  higdonWeeklyKm: number;
  currentWeek: number;
  totalWeeks: number;
  prevActualLongRunKm: number | null;
  recentPatchedAt: Date | null;
  projectedACWR: number;
}

export interface ValidationResult {
  valid: boolean;
  violations: string[];
  patchAfterGuardrails: SessionPatch;
}

const RACE_TYPES = new Set(["RACE_5K", "RACE_10K", "RACE_HALF", "RACE_MARATHON"]);
const TAPER_WEEK_BUFFER = 3;

export function validatePatch(patch: SessionPatch, ctx: GuardrailContext): ValidationResult {
  const violations: string[] = [];
  const changes = { ...patch.changes };

  const isRace = RACE_TYPES.has((changes.sessionType ?? "").toUpperCase());
  if (isRace) {
    return { valid: false, violations: ["cannot_modify_race_session"], patchAfterGuardrails: patch };
  }

  const isInTaper = ctx.currentWeek > ctx.totalWeeks - TAPER_WEEK_BUFFER;

  if (changes.distanceKm !== undefined) {
    const orig = ctx.originalDistanceKm;
    let d = changes.distanceKm;

    if (d < orig * 0.60) {
      d = Math.round(orig * 0.60 * 10) / 10;
      violations.push("distance_floored_at_60pct");
    }
    if (d > orig * 1.20) {
      d = Math.round(orig * 1.20 * 10) / 10;
      violations.push("distance_capped_at_120pct");
    }
    if (isInTaper && d > orig) {
      d = orig;
      violations.push("no_increases_in_taper");
    }
    if (ctx.prevActualLongRunKm !== null && d > ctx.prevActualLongRunKm + 1.5) {
      d = Math.round((ctx.prevActualLongRunKm + 1.5) * 10) / 10;
      violations.push("long_run_growth_capped_at_1.5km");
    }
    changes.distanceKm = d;
  }

  // Projected ACWR after this patch must not exceed 1.4
  if (ctx.projectedACWR > 1.4) {
    violations.push("projected_acwr_above_1.4");
    if (changes.distanceKm !== undefined) {
      changes.distanceKm = Math.round(changes.distanceKm * 0.90 * 10) / 10;
    }
  }

  return {
    valid: violations.length === 0,
    violations,
    patchAfterGuardrails: { ...patch, changes },
  };
}
