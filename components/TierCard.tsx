"use client";

import Image from "next/image";
import type { CSSProperties, ReactNode } from "react";
import { memo } from "react";
import { Trophy } from "lucide-react";
import type { TierConfig } from "@/lib/playerCardTiers";

export type TierCardStat = {
  key: string;
  fullName: string;
  value: number;
  color: string;
};

export type TierCardProps = {
  tier: TierConfig;
  name: string;
  /** Overall rating (authoritative). */
  rank: number;
  /** Animated display value; defaults to `rank`. */
  displayRank?: number;
  stats: readonly TierCardStat[];
  prevRank?: number;
  variant: "compact" | "full";
  pointsToNext?: number | null;
  nextTierName?: string | null;
  badge?: ReactNode;
};

function tierBandProgress(rank: number, tier: TierConfig): number {
  const span = Math.max(1, tier.max - tier.min);
  return Math.min(100, Math.max(0, ((rank - tier.min) / span) * 100));
}

/** Left-heavy scrim: keeps PNG blacks visually continuous with matte #000 face */
const CARD_SCRIM =
  "linear-gradient(105deg, #000000 0%, #000000 20%, rgba(0,0,0,0.88) 38%, rgba(0,0,0,0.42) 58%, rgba(0,0,0,0.08) 76%, transparent 100%)";

/** Subtle bottom weight only — avoids stacking a second full-card wash */
const CARD_VIGNETTE =
  "linear-gradient(180deg, transparent 0%, transparent 52%, rgba(0,0,0,0.22) 100%)";

function TierCard({
  tier,
  name,
  rank,
  displayRank,
  stats,
  prevRank,
  variant,
  pointsToNext,
  nextTierName,
  badge,
}: TierCardProps) {
  const showRank = displayRank ?? rank;
  const bandPct = tierBandProgress(rank, tier);
  const showXp =
    variant === "full"
    && pointsToNext != null
    && nextTierName != null
    && pointsToNext > 0;

  const glowVars = {
    "--tier-glow-rest": tier.glowShadow,
    "--tier-glow-hover": tier.glowShadowHover,
  } as CSSProperties;

  const accentIcon =
    badge ?? (
      <Trophy
        className="w-4 h-4 sm:w-5 sm:h-5 opacity-90"
        style={{ color: tier.accentColor }}
        strokeWidth={2}
        aria-hidden
      />
    );

  const imageSizes =
    variant === "compact"
      ? "(max-width: 640px) 72vw, 320px"
      : "(max-width: 640px) 88vw, (max-width: 1024px) 480px, 520px";

  const artwork = (
    <Image
      src={tier.cardArt}
      width={920}
      height={560}
      alt=""
      priority={variant === "full"}
      loading={variant === "full" ? undefined : "lazy"}
      sizes={imageSizes}
      className={
        variant === "compact"
          ? "pointer-events-none select-none absolute z-[1] right-[-3%] bottom-[-10%] sm:right-[-3%] sm:bottom-[-9%] w-[min(68vw,248px)] sm:w-[min(68%,300px)] max-h-[min(46vw,188px)] sm:max-h-[200px] h-auto object-contain object-right-bottom translate-x-[2%]"
          : "pointer-events-none select-none absolute z-[1] right-[-5%] bottom-[-11%] sm:right-[-4%] sm:bottom-[-10%] md:right-[-3%] md:bottom-[-9%] w-[min(82vw,340px)] sm:w-[min(78%,420px)] md:w-[min(72%,480px)] max-h-[min(52vw,280px)] sm:max-h-[min(48vw,320px)] md:max-h-[360px] h-auto object-contain object-right-bottom translate-x-[1%]"
      }
    />
  );

  const shimmerLayer =
    tier.shimmer ? (
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-[3] h-[52%] opacity-[0.22] mix-blend-overlay overflow-hidden rounded-t-3xl"
        style={{
          background:
            "linear-gradient(100deg, transparent 0%, rgba(255,255,255,0.06) 48%, transparent 76%)",
          animation: "rs-shimmer 5s ease-in-out infinite",
        }}
      />
    ) : null;

  return (
    <div
      role="article"
      className="tier-card-shell rounded-3xl hover:-translate-y-0.5 hover:scale-[1.003] motion-reduce:hover:translate-y-0 motion-reduce:hover:scale-100"
      style={glowVars}
    >
      <div
        className="relative rounded-3xl bg-[#000000] overflow-hidden border border-white/[0.06]"
        style={{ boxShadow: `inset 0 1px 0 ${tier.rimLight}` }}
      >
        {artwork}

        <div
          className="pointer-events-none absolute inset-0 z-[2]"
          style={{ background: `${CARD_SCRIM}, ${CARD_VIGNETTE}` }}
        />

        {shimmerLayer}

        {variant === "compact" ? (
          <div className="relative z-10 flex flex-col gap-4 p-4 sm:p-5 sm:pr-6 sm:flex-row sm:items-stretch min-h-[172px] sm:min-h-[192px]">
            <div className="flex-1 flex flex-col justify-center min-w-0 pr-[38%] sm:pr-[40%]">
              <div className="flex items-center gap-2 mb-1.5">
                {accentIcon}
                <span className="text-[10px] font-bold tracking-[0.24em] uppercase text-[var(--text-label)]">
                  Running card
                </span>
              </div>
              <p className="text-sm sm:text-[15px] font-black tracking-[0.05em] text-white truncate">
                {name}
              </p>
              <p
                className="text-[11px] sm:text-xs font-bold uppercase tracking-[0.16em] mt-1 text-white/90"
                style={{ color: tier.accentColor }}
              >
                {tier.name}
              </p>
              <div className="flex flex-wrap items-end gap-3 mt-3">
                <div>
                  <p
                    className="text-[2.65rem] sm:text-[3.1rem] font-black leading-none font-mono tabular-nums tracking-tight"
                    style={{ color: tier.ovrColor }}
                  >
                    {showRank}
                  </p>
                  <p className="text-[9px] font-bold tracking-[0.22em] text-[var(--text-dim)] mt-1">
                    OVR
                  </p>
                </div>
                {prevRank !== undefined && rank !== prevRank && (
                  <p
                    className="text-xs font-bold pb-1"
                    style={{ color: rank > prevRank ? "#4ade80" : "#f87171" }}
                  >
                    {rank > prevRank ? "+" : ""}
                    {rank - prevRank} OVR
                  </p>
                )}
              </div>
              <div className="mt-3 h-1 rounded-full bg-white/[0.06] overflow-hidden border border-white/[0.05] max-w-[min(220px,88%)]">
                <div
                  className="h-full rounded-full transition-[width] duration-700 ease-out"
                  style={{ width: `${bandPct}%`, background: tier.accentColor }}
                />
              </div>
            </div>

            <div className="relative z-10 grid grid-cols-5 sm:grid-cols-3 gap-x-1.5 gap-y-2 sm:gap-x-2 sm:gap-y-2.5 text-center w-full sm:w-[208px] shrink-0 self-center sm:self-auto max-sm:px-0.5">
              {stats.map((attr) => (
                <div key={attr.key} className="min-w-0">
                  <p className="text-[8px] sm:text-[9px] font-bold tracking-[0.1em] sm:tracking-[0.12em] text-[var(--text-label)] truncate">
                    {attr.key}
                  </p>
                  <p
                    className="text-xs sm:text-base font-black font-mono tabular-nums leading-tight mt-0.5"
                    style={{ color: attr.color }}
                  >
                    {attr.value}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="relative z-10 flex flex-col p-5 sm:p-7 md:p-8 min-h-[392px] md:min-h-[428px]">
            <div className="flex items-start justify-between gap-3 max-w-[min(100%,19rem)] sm:max-w-[min(100%,22rem)] md:max-w-[56%]">
              <div className="flex items-center gap-2 min-w-0">
                {accentIcon}
                <span className="text-[10px] font-bold tracking-[0.24em] uppercase text-[var(--text-label)]">
                  Running card
                </span>
              </div>
            </div>

            <p className="mt-4 text-lg sm:text-xl font-black tracking-[0.06em] text-white truncate max-w-[min(100%,19rem)] sm:max-w-[min(100%,24rem)] md:max-w-[58%]">
              {name}
            </p>
            <p
              className="text-[11px] sm:text-xs font-bold uppercase tracking-[0.16em] mt-1.5 max-w-[min(100%,19rem)] md:max-w-[58%]"
              style={{ color: tier.accentColor }}
            >
              {tier.name}
            </p>

            <div className="mt-5 flex flex-wrap items-end gap-4 max-w-[min(100%,20rem)] md:max-w-[56%]">
              <p
                className="text-[clamp(2.65rem,11vw,6rem)] sm:text-7xl md:text-8xl font-black leading-none font-mono tabular-nums tracking-tight"
                style={{ color: tier.ovrColor }}
              >
                {showRank}
              </p>
              <div className="pb-2 min-w-0">
                <p className="text-[10px] font-bold tracking-[0.2em] text-[var(--text-dim)]">
                  RANK · OVR
                </p>
                {prevRank !== undefined && rank !== prevRank && (
                  <p
                    className="text-sm font-bold mt-1"
                    style={{ color: rank > prevRank ? "#4ade80" : "#f87171" }}
                  >
                    {rank > prevRank ? "+" : ""}
                    {rank - prevRank} since last sync
                  </p>
                )}
              </div>
            </div>

            {showXp && (
              <div className="mt-6 max-w-md md:max-w-[56%] space-y-2">
                <div className="flex justify-between items-baseline gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--text-label)]">
                  <span>XP track</span>
                  <span className="text-white/65 normal-case tracking-normal font-semibold text-right">
                    {pointsToNext} pts to {nextTierName}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-white/[0.07] overflow-hidden border border-white/[0.06]">
                  <div
                    className="h-full rounded-full transition-[width] duration-700 ease-out"
                    style={{ width: `${bandPct}%`, background: tier.accentColor }}
                  />
                </div>
                <p className="text-[11px] text-[var(--text-dim)] leading-snug">
                  Progress within {tier.name} band ({tier.min}–{tier.max} OVR)
                </p>
              </div>
            )}

            <div className="mt-auto pt-7 border-t border-white/[0.08] space-y-3 flex-1 w-full max-w-xl md:max-w-[min(100%,36rem)]">
              {stats.map((attr, index) => {
                const width = Math.min(100, Math.max(0, (attr.value / 99) * 100));
                return (
                  <div key={attr.key} className="flex items-center gap-2 sm:gap-3 min-w-0">
                    <span className="w-8 sm:w-10 shrink-0 text-[10px] font-bold tracking-[0.12em] text-[var(--text-label)]">
                      {attr.key}
                    </span>
                    <div className="flex-1 min-w-0 h-2 rounded-full bg-white/[0.07] overflow-hidden border border-white/[0.05]">
                      <div
                        className="h-full rounded-full transition-[width] duration-700 ease-out gpu-bar-grow"
                        style={{
                          width: `${width}%`,
                          background: attr.color,
                          transitionDelay: `${index * 70}ms`,
                        }}
                      />
                    </div>
                    <span
                      className="w-7 sm:w-9 shrink-0 text-sm font-extrabold font-mono tabular-nums text-right"
                      style={{ color: attr.color }}
                    >
                      {attr.value}
                    </span>
                    <span className="hidden md:block w-24 lg:w-28 shrink-0 text-[11px] text-[var(--text-muted)] truncate text-right">
                      {attr.fullName}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default memo(TierCard);
