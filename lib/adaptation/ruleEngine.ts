export type Tier = 0 | 1 | 2 | 3;

export interface AdaptationContext {
  recentScores: number[];       // most recent first, up to 7
  lastRatingScore: number | null;
  last3AvgScore: number | null;
  acwr: number;
  complianceRate: number;       // 0–1
  daysSinceLastRun: number;
  missedLongRun: boolean;
  hrTrendBpm: number | null;    // +ve = HR rising at same pace
  tier2FiredAt: Date | null;
  tier3FiredAt: Date | null;
  currentWeek: number;
  totalWeeks: number;
  isInTaper: boolean;
}

export interface TierDecision {
  tier: Tier;
  reason: string;
}

export function determineTier(ctx: AdaptationContext): TierDecision {
  // Taper: never restructure (last 3 weeks)
  if (ctx.isInTaper) return { tier: 0, reason: "taper_protected" };

  // 7-day cooldown after Tier 2+ (unless injury signal)
  if (ctx.tier2FiredAt) {
    const daysSince = (Date.now() - ctx.tier2FiredAt.getTime()) / 86400000;
    const injurySignal = ctx.hrTrendBpm !== null && ctx.hrTrendBpm > 5;
    if (daysSince < 7 && !injurySignal) return { tier: 0, reason: "cooldown_active" };
  }

  const isSingleRun = ctx.recentScores.length === 1;

  // ── Tier 3 (requires at least 2 prior runs) ───────────────────────────────
  if (!isSingleRun) {
    if (ctx.daysSinceLastRun > 10) {
      return { tier: 3, reason: "extended_break_over_10_days" };
    }

    const injurySignal = ctx.hrTrendBpm !== null && ctx.hrTrendBpm > 5;
    if (injurySignal) return { tier: 3, reason: "injury_signal_hr_trend" };

    const tier2RecentlyFiredTwice =
      ctx.tier2FiredAt && ctx.tier3FiredAt &&
      (Date.now() - ctx.tier2FiredAt.getTime()) / 86400000 < 21 &&
      (Date.now() - ctx.tier3FiredAt.getTime()) / 86400000 < 21;
    if (tier2RecentlyFiredTwice) return { tier: 3, reason: "repeated_tier2_in_3_weeks" };
  }

  // ── Tier 2 (requires at least 2 prior runs) ───────────────────────────────
  if (!isSingleRun) {
    const twoConsecutiveBelow5 =
      ctx.recentScores.length >= 2 && ctx.recentScores[0] < 5 && ctx.recentScores[1] < 5;
    const longRunBelow4 = ctx.lastRatingScore !== null && ctx.lastRatingScore < 4;
    const highACWR = ctx.acwr > 1.5;

    if (twoConsecutiveBelow5 || longRunBelow4 || highACWR || ctx.missedLongRun) {
      return {
        tier: 2,
        reason: twoConsecutiveBelow5 ? "two_consecutive_below_5"
          : longRunBelow4 ? "long_run_below_4"
          : highACWR ? "acwr_above_1.5"
          : "missed_long_run",
      };
    }
  }

  // ── Tier 1 ────────────────────────────────────────────────────────────────
  const score = ctx.lastRatingScore ?? 10;
  const scoreBorderline = score >= 5 && score < 7;
  const acwrBorderline = ctx.acwr > 1.3 && ctx.acwr <= 1.5;

  if (scoreBorderline || acwrBorderline) {
    return {
      tier: 1,
      reason: scoreBorderline ? "score_5_to_7" : "acwr_1.3_to_1.5",
    };
  }

  return { tier: 0, reason: "stable" };
}
