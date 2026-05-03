import { validatePatch, type SessionPatch, type GuardrailContext } from "./guardrails";

// Tier 1: minor tweak — reduce by 5–10% based on ACWR and last score
export function buildTier1Patch(
  scheduledSessionId: string,
  originalDistKm: number,
  acwr: number,
  lastScore: number | null,
  guardrailCtx: GuardrailContext
): SessionPatch {
  const acwrFactor = acwr > 1.3 ? 0.92 : acwr > 1.2 ? 0.95 : 1.0;
  const scoreFactor = (lastScore !== null && lastScore < 6) ? 0.93 : 1.0;
  const factor = Math.min(acwrFactor, scoreFactor);

  const raw: SessionPatch = {
    scheduledSessionId,
    changes: {
      distanceKm: Math.round(originalDistKm * factor * 10) / 10,
      notes: "Auto-adjusted (Tier 1): minor volume reduction",
    },
    rationale: `Tier 1: ${Math.round((1 - factor) * 100)}% reduction. ACWR=${acwr.toFixed(2)}`,
  };

  return validatePatch(raw, guardrailCtx).patchAfterGuardrails;
}

// Tier 2: restructure — reduce 15–25%, lock HR zone to 2 (recovery)
export function buildTier2Patch(
  scheduledSessionId: string,
  originalDistKm: number,
  acwr: number,
  reason: string,
  guardrailCtx: GuardrailContext
): SessionPatch {
  const pct = acwr > 1.5 ? 0.25 : 0.20;

  const raw: SessionPatch = {
    scheduledSessionId,
    changes: {
      distanceKm: Math.round(originalDistKm * (1 - pct) * 10) / 10,
      targetHrZone: 2,
      notes: "Auto-adjusted (Tier 2): recovery week. Keep effort easy.",
    },
    rationale: `Tier 2: ${Math.round(pct * 100)}% reduction. Reason: ${reason}`,
  };

  return validatePatch(raw, guardrailCtx).patchAfterGuardrails;
}
