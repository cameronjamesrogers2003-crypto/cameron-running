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
        className="w-4 h-4 sm:w-5 sm:h-5 shrink-0 opacity-90"
        style={{ color: tier.accentColor }}
        strokeWidth={2}
        aria-hidden
      />
    );

  const shimmerLayer =
    tier.shimmer ? (
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-[1] h-[42%] opacity-[0.18] mix-blend-overlay overflow-hidden rounded-t-3xl"
        style={{
          background:
            "linear-gradient(100deg, transparent 0%, rgba(255,255,255,0.06) 48%, transparent 76%)",
          animation: "rs-shimmer 5s ease-in-out infinite",
        }}
      />
    ) : null;

  const isCompact = variant === "compact";

  const artSlotClass = isCompact
    ? "flex items-end justify-end pt-2 pb-4 px-4 sm:px-5 sm:pb-5 md:p-5 md:pt-6 min-h-[112px] sm:min-h-[128px] md:min-h-0 md:w-[148px] lg:w-[168px] shrink-0 border-t border-white/[0.06] md:border-t-0 md:border-l border-white/[0.06]"
    : "flex items-end justify-end pt-3 pb-5 px-5 sm:p-6 md:p-6 lg:p-8 md:pt-8 min-h-[160px] sm:min-h-[180px] md:min-h-0 md:w-[192px] lg:w-[228px] xl:w-[248px] shrink-0 border-t md:border-t-0 md:border-l border-white/[0.06]";

  const imageClass = isCompact
    ? "pointer-events-none select-none h-auto w-full max-h-[104px] sm:max-h-[118px] md:max-h-[132px] max-w-[112px] sm:max-w-[124px] md:max-w-full object-contain object-bottom object-right"
    : "pointer-events-none select-none h-auto w-full max-h-[180px] sm:max-h-[200px] md:max-h-[230px] lg:max-h-[260px] xl:max-h-[272px] max-w-[200px] sm:max-w-[220px] md:max-w-full object-contain object-bottom object-right";

  const imageSizes = isCompact
    ? "(max-width: 768px) 140px, 168px"
    : "(max-width: 768px) 220px, 260px";

  const artwork = (
    <Image
      src={tier.cardArt}
      width={920}
      height={560}
      alt=""
      priority={variant === "full"}
      loading={variant === "full" ? undefined : "lazy"}
      sizes={imageSizes}
      className={imageClass}
    />
  );

  const runningCardRow = (
    <div className="flex items-center gap-2 min-w-0">
      {accentIcon}
      <span className="text-[10px] font-bold tracking-[0.24em] uppercase text-[var(--text-label)] truncate">
        Running card
      </span>
    </div>
  );

  return (
    <div
      role="article"
      className="tier-card-shell rounded-3xl hover:-translate-y-0.5 hover:scale-[1.003] motion-reduce:hover:translate-y-0 motion-reduce:hover:scale-100"
      style={glowVars}
    >
      <div
        className="relative rounded-3xl bg-[#050505] overflow-hidden border border-white/[0.07]"
        style={{ boxShadow: `inset 0 1px 0 ${tier.rimLight}` }}
      >
        {shimmerLayer}

        {isCompact ? (
          <div className="relative z-[2] flex flex-col md:flex-row md:items-stretch min-h-0">
            <div className="flex flex-col flex-1 min-w-0 gap-3 p-4 sm:p-5 md:pr-5">
              {runningCardRow}
              <p className="text-sm sm:text-[15px] font-black tracking-[0.05em] text-white break-words">
                {name}
              </p>
              <p
                className="text-[11px] sm:text-xs font-bold uppercase tracking-[0.16em]"
                style={{ color: tier.accentColor }}
              >
                {tier.name}
              </p>
              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <p
                    className="text-[2.5rem] sm:text-[2.85rem] font-black leading-none font-mono tabular-nums tracking-tight"
                    style={{ color: tier.ovrColor }}
                  >
                    {showRank}
                  </p>
                  <p className="text-[9px] font-bold tracking-[0.22em] text-[var(--text-dim)] mt-1">OVR</p>
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
              <div className="h-1 rounded-full bg-white/[0.06] overflow-hidden border border-white/[0.05] max-w-xs">
                <div
                  className="h-full rounded-full transition-[width] duration-700 ease-out"
                  style={{ width: `${bandPct}%`, background: tier.accentColor }}
                />
              </div>
              <div className="grid grid-cols-5 gap-x-2 gap-y-1 pt-1 border-t border-white/[0.07]">
                {stats.map((attr) => (
                  <div key={attr.key} className="min-w-0 text-center md:text-left">
                    <p className="text-[8px] sm:text-[9px] font-bold tracking-[0.12em] text-[var(--text-label)] truncate">
                      {attr.key}
                    </p>
                    <p
                      className="text-xs sm:text-sm font-black font-mono tabular-nums leading-tight mt-0.5"
                      style={{ color: attr.color }}
                    >
                      {attr.value}
                    </p>
                  </div>
                ))}
              </div>
            </div>
            <div className={artSlotClass}>{artwork}</div>
          </div>
        ) : (
          <div className="relative z-[2] flex flex-col md:flex-row md:items-stretch min-h-[360px] md:min-h-[380px]">
            <div className="flex flex-col flex-1 min-w-0 gap-4 p-5 sm:p-6 lg:p-8 lg:pr-6">
              {runningCardRow}
              <p className="text-lg sm:text-xl font-black tracking-[0.06em] text-white break-words">
                {name}
              </p>
              <p
                className="text-xs font-bold uppercase tracking-[0.16em]"
                style={{ color: tier.accentColor }}
              >
                {tier.name}
              </p>
              <div className="flex flex-wrap items-end gap-4">
                <p
                  className="text-[clamp(2.75rem,9vw,5.5rem)] lg:text-7xl xl:text-8xl font-black leading-none font-mono tabular-nums tracking-tight"
                  style={{ color: tier.ovrColor }}
                >
                  {showRank}
                </p>
                <div className="pb-1 min-w-0">
                  <p className="text-[10px] font-bold tracking-[0.2em] text-[var(--text-dim)]">RANK · OVR</p>
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
                <div className="space-y-2 max-w-lg">
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

              <div className="mt-auto pt-6 border-t border-white/[0.08] space-y-3 w-full max-w-xl">
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
                      <span className="hidden sm:block w-20 lg:w-28 shrink-0 text-[11px] text-[var(--text-muted)] truncate text-right">
                        {attr.fullName}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className={artSlotClass}>{artwork}</div>
          </div>
        )}
      </div>
    </div>
  );
}

export default memo(TierCard);
