// Local SessionType — mirrors the Prisma enum but keeps scoring functions pure (no DB dependency)
export type SessionType =
  | "EASY" | "LONG" | "SORTA_LONG" | "PACE" | "TEMPO"
  | "INTERVALS" | "REST" | "CROSS"
  | "RACE_5K" | "RACE_10K" | "RACE_HALF" | "RACE_MARATHON";

// 0–1. Long runs: only penalise under-distance.
// Full credit within ±5%, linear decay to 0 at ±50%.
export function scoreDistance(
  actualKm: number,
  plannedKm: number,
  sessionType: SessionType
): number {
  if (plannedKm <= 0) return 1;
  if ((sessionType === "LONG" || sessionType === "SORTA_LONG") && actualKm >= plannedKm) return 1;

  const deviation = Math.abs(actualKm - plannedKm) / plannedKm;
  const adjusted = Math.max(0, deviation - 0.05);
  return Math.max(0, 1 - adjusted / 0.45);
}

// 0–1. Compares grade-adjusted pace against the heat-corrected target band.
// Easy/long runs: too-fast penalty is 1.5× too-slow (overtraining risk).
export function scorePace(
  actualGapSecKm: number,
  targetLowSecKm: number,
  targetHighSecKm: number,
  sessionType: SessionType
): number {
  if (!actualGapSecKm || !targetLowSecKm || !targetHighSecKm) return 0.5;

  if (actualGapSecKm >= targetLowSecKm && actualGapSecKm <= targetHighSecKm) return 1;

  const bandWidth = Math.max(1, targetHighSecKm - targetLowSecKm);

  if (actualGapSecKm < targetLowSecKm) {
    const overshoot = (targetLowSecKm - actualGapSecKm) / bandWidth;
    const mult = (sessionType === "EASY" || sessionType === "LONG" || sessionType === "SORTA_LONG") ? 1.5 : 1.0;
    return Math.max(0, 1 - overshoot * mult);
  }

  const overshoot = (actualGapSecKm - targetHighSecKm) / bandWidth;
  return Math.max(0, 1 - overshoot);
}

// 0–1 or null if HR data is invalid (avg < 70 or > 220-age).
// Bonus +0.05 if aerobic decoupling < 5% on long/sorta-long.
export function scoreHR(
  pctTimeInZone: number,
  decouplingPct: number | null,
  sessionType: SessionType,
  avgHR: number | null,
  ageYears: number
): number | null {
  const maxHR = 220 - ageYears;
  if (!avgHR || avgHR < 70 || avgHR > maxHR) return null;

  let score = Math.min(1, pctTimeInZone / 100);

  if ((sessionType === "LONG" || sessionType === "SORTA_LONG") &&
      decouplingPct !== null && decouplingPct < 5) {
    score = Math.min(1, score + 0.05);
  }

  return Math.max(0, score);
}

// 0–1. Penalties: paused time > 10%, high decoupling on long runs, HR above LTHR on easy.
export function scoreExecution(
  pausedPct: number,
  decouplingPct: number | null,
  avgHR: number | null,
  lthr: number,
  sessionType: SessionType,
  highHumidity: boolean
): number {
  let score = 1.0;

  if (pausedPct > 0.10) {
    score -= Math.min(0.4, (pausedPct - 0.10) * 2);
  }

  // Humidity above 20°C dew point raises the acceptable decoupling threshold
  const decouplingLimit = highHumidity ? 8 : 5;
  if ((sessionType === "LONG" || sessionType === "SORTA_LONG") &&
      decouplingPct !== null && decouplingPct > decouplingLimit + 3) {
    score -= 0.15;
  }

  if ((sessionType === "EASY" || sessionType === "LONG" || sessionType === "SORTA_LONG") &&
      avgHR !== null && avgHR > lthr) {
    score -= 0.2;
  }

  return Math.max(0, score);
}

// Combines sub-scores with spec weights. If HR is null (invalid), redistributes.
export function computeFinalScore(
  distScore: number,
  paceScore: number,
  hrScore: number | null,
  execScore: number
): number {
  const weighted = hrScore === null
    ? distScore * 0.40 + paceScore * 0.40 + execScore * 0.20
    : distScore * 0.30 + paceScore * 0.30 + hrScore * 0.25 + execScore * 0.15;

  return Math.round(Math.min(1, Math.max(0, weighted)) * 100) / 10;
}
