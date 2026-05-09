"use client";

import Image from "next/image";
import type { CSSProperties, ReactNode } from "react";
import { memo, useCallback, useMemo, useState } from "react";
import { Trophy } from "lucide-react";
import type { TierConfig } from "@/lib/playerCardTiers";
import { getTierGlowHex, tierShellBoxShadow } from "@/lib/tierGlowColors";

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

const LEFT_PANEL = "relative flex flex-col flex-1 min-w-0 bg-black";
/** Art column — solid black (PNG blends via mix-blend-screen on the img only). */
const ART_PANEL_BASE =
  "relative flex shrink-0 flex-col bg-black overflow-hidden border-t border-white/[0.06] md:border-t-0 md:border-l md:border-white/[0.06]";

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
  const [hoverShell, setHoverShell] = useState(false);

  const showRank = displayRank ?? rank;
  const bandPct = tierBandProgress(rank, tier);
  const showXp =
    variant === "full"
    && pointsToNext != null
    && nextTierName != null
    && pointsToNext > 0;

  const glowHex = useMemo(() => getTierGlowHex(tier.name), [tier.name]);

  const shellSurface: CSSProperties = useMemo(
    () => ({
      border: `1.5px solid ${glowHex}`,
      boxShadow: tierShellBoxShadow(glowHex, hoverShell),
    }),
    [glowHex, hoverShell],
  );

  const accentVars = { "--tier-accent": tier.accentColor } as CSSProperties;

  const onShellEnter = useCallback(() => setHoverShell(true), []);
  const onShellLeave = useCallback(() => setHoverShell(false), []);

  const accentIcon =
    badge ?? (
      <Trophy
        className="w-4 h-4 sm:w-5 sm:h-5 shrink-0 opacity-90"
        style={{
          color: tier.accentColor,
          filter: `drop-shadow(0 0 10px ${tier.accentColor}55)`,
        }}
        strokeWidth={2}
        aria-hidden
      />
    );

  const shimmerLayer =
    tier.shimmer ? (
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-[3] h-[42%] opacity-[0.12] mix-blend-overlay overflow-hidden rounded-3xl"
        style={{
          background:
            "linear-gradient(100deg, transparent 0%, rgba(255,255,255,0.06) 46%, transparent 78%)",
          animation: "rs-shimmer 5.5s ease-in-out infinite",
        }}
      />
    ) : null;

  const isCompact = variant === "compact";

  const artShellClass = isCompact
    ? `${ART_PANEL_BASE} min-h-[180px] sm:min-h-[200px] md:min-h-0 md:flex-[0_0_42%] md:max-w-[46%]`
    : `${ART_PANEL_BASE} min-h-[220px] sm:min-h-[260px] md:min-h-0 md:flex-[0_0_44%] md:max-w-[48%]`;

  const imageClass = isCompact
    ? [
        "pointer-events-none select-none mix-blend-screen",
        "h-auto w-auto max-h-[min(240px,48vh)] max-w-[min(100%,220px)] sm:max-h-[260px] sm:max-w-[240px]",
        "md:max-h-[min(288px,calc(100%-2rem))] md:max-w-[min(100%,280px)]",
        "object-contain object-center",
      ].join(" ")
    : [
        "pointer-events-none select-none mix-blend-screen",
        "h-auto w-auto max-h-[min(340px,55vh)] max-w-[min(100%,300px)] sm:max-h-[380px] sm:max-w-[340px]",
        "md:max-h-[min(420px,calc(100%-2.5rem))] md:max-w-[min(100%,380px)]",
        "object-contain object-center",
      ].join(" ");

  const imageSizes = isCompact
    ? "(max-width: 768px) 260px, 300px"
    : "(max-width: 768px) 340px, 400px";

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
    <div className="flex items-center gap-2.5 min-w-0">
      {accentIcon}
      <span className="text-[10px] font-bold tracking-[0.26em] uppercase text-[var(--text-label)] truncate">
        Running card
      </span>
    </div>
  );

  const ovrBlockCompact = (
    <div className="rounded-xl border border-white/[0.1] bg-black px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <p className="text-[9px] font-bold tracking-[0.22em] text-[var(--text-dim)] mb-1">RATING</p>
          <p
            className="text-[2.35rem] sm:text-[2.65rem] font-black leading-none font-mono tabular-nums tracking-tight"
            style={{ color: tier.ovrColor }}
          >
            {showRank}
          </p>
          <p className="text-[9px] font-bold tracking-[0.2em] text-[var(--text-label)] mt-1">OVR</p>
        </div>
        {prevRank !== undefined && rank !== prevRank && (
          <p
            className="text-[11px] font-bold pb-0.5 px-2 py-1 rounded-md bg-white/[0.06] border border-white/[0.08]"
            style={{ color: rank > prevRank ? "#4ade80" : "#f87171" }}
          >
            {rank > prevRank ? "+" : ""}
            {rank - prevRank} OVR
          </p>
        )}
      </div>
    </div>
  );

  const ovrBlockFull = (
    <div className="rounded-2xl border border-white/[0.1] bg-black px-4 py-3 sm:px-5 sm:py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] max-w-md">
      <div className="flex flex-wrap items-start gap-5 sm:gap-6">
        <div className="min-w-0">
          <p className="text-[10px] font-bold tracking-[0.22em] text-[var(--text-dim)] mb-1.5">OVERALL</p>
          <p
            className="text-[clamp(2.6rem,7vw,4.25rem)] lg:text-[4.5rem] xl:text-[4.85rem] font-black leading-[0.92] font-mono tabular-nums tracking-tight"
            style={{ color: tier.ovrColor }}
          >
            {showRank}
          </p>
          <p className="text-[10px] font-bold tracking-[0.2em] text-[var(--text-label)] mt-2">RANK · OVR</p>
        </div>
        <div className="flex-1 min-w-[9rem] pt-1 border-l border-white/[0.1] pl-5 sm:pl-6">
          <p className="text-[11px] font-semibold text-white/75 leading-snug">
            <span className="text-[var(--text-label)] uppercase tracking-[0.14em] text-[10px] font-bold block mb-1">
              Tier
            </span>
            <span style={{ color: tier.accentColor }}>{tier.name}</span>
          </p>
          {prevRank !== undefined && rank !== prevRank && (
            <p
              className="text-sm font-bold mt-3 px-2.5 py-1.5 rounded-lg inline-block bg-white/[0.06] border border-white/[0.08]"
              style={{ color: rank > prevRank ? "#4ade80" : "#f87171" }}
            >
              {rank > prevRank ? "+" : ""}
              {rank - prevRank} since last sync
            </p>
          )}
        </div>
      </div>
    </div>
  );

  const heroArtSlot = (
    <div className={artShellClass} style={accentVars}>
      <div className="flex flex-1 min-h-0 w-full items-center justify-center px-4 py-5 sm:px-5 sm:py-6 md:p-6">
        {artwork}
      </div>
    </div>
  );

  return (
    <div
      role="article"
      className="rounded-3xl transition-[transform,box-shadow] duration-300 ease-out hover:-translate-y-0.5 motion-reduce:transform-none"
      style={shellSurface}
      onMouseEnter={onShellEnter}
      onMouseLeave={onShellLeave}
    >
      <div
        className="relative rounded-[calc(1.5rem-1px)] bg-black overflow-hidden"
        style={{ boxShadow: `inset 0 1px 0 ${tier.rimLight}` }}
      >
        {shimmerLayer}

        {isCompact ? (
          <div className="relative z-[2] flex flex-col md:flex-row md:items-stretch min-h-0">
            <div className={`${LEFT_PANEL} gap-3.5 p-4 sm:p-5 md:pr-5 md:py-6`}>
              {runningCardRow}
              <p className="text-sm sm:text-[15px] font-black tracking-[0.05em] text-white break-words">{name}</p>
              <p
                className="text-[11px] sm:text-xs font-bold uppercase tracking-[0.18em]"
                style={{ color: tier.accentColor }}
              >
                {tier.name}
              </p>
              {ovrBlockCompact}
              <div className="rounded-full tier-card-stat-track max-w-xs overflow-hidden border border-white/[0.08]">
                <div
                  className="h-full rounded-full transition-[width] duration-700 ease-out"
                  style={{
                    width: `${bandPct}%`,
                    background: tier.accentColor,
                    boxShadow: `0 0 14px ${tier.accentColor}44`,
                  }}
                />
              </div>
              <div className="flex flex-col gap-2.5 pt-2">
                {stats.map((attr) => (
                  <div
                    key={attr.key}
                    className="flex items-center justify-between gap-3 min-w-0 rounded-lg border border-white/[0.08] px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] bg-black"
                  >
                    <p className="text-base font-semibold text-white/90 truncate min-w-0 leading-snug">{attr.fullName}</p>
                    <p
                      className="text-xl font-black font-mono tabular-nums shrink-0 leading-none"
                      style={{ color: attr.color }}
                    >
                      {attr.value}
                    </p>
                  </div>
                ))}
              </div>
            </div>
            {heroArtSlot}
          </div>
        ) : (
          <div className="relative z-[2] flex flex-col md:flex-row md:items-stretch min-h-[380px] md:min-h-[420px]">
            <div className={`${LEFT_PANEL} gap-4 sm:gap-5 p-5 sm:p-6 lg:p-8 lg:pr-6`}>
              {runningCardRow}
              <p className="text-lg sm:text-xl font-black tracking-[0.06em] text-white break-words">{name}</p>

              {ovrBlockFull}

              {showXp && (
                <div className="rounded-xl border border-white/[0.1] bg-black px-4 py-3 space-y-2.5 max-w-lg shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                  <div className="flex justify-between items-baseline gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--text-label)]">
                    <span>XP track</span>
                    <span className="text-white/70 normal-case tracking-normal font-semibold text-right">
                      {pointsToNext} pts to {nextTierName}
                    </span>
                  </div>
                  <div className="tier-card-stat-track overflow-hidden border border-white/[0.08]">
                    <div
                      className="h-full rounded-full transition-[width] duration-700 ease-out"
                      style={{
                        width: `${bandPct}%`,
                        background: tier.accentColor,
                        boxShadow: `0 0 16px ${tier.accentColor}44`,
                      }}
                    />
                  </div>
                  <p className="text-[11px] text-[var(--text-dim)] leading-snug">
                    Progress within {tier.name} band ({tier.min}–{tier.max} OVR)
                  </p>
                </div>
              )}

              <div className="mt-auto pt-6 border-t border-white/[0.08] space-y-3 w-full">
                <p className="text-[10px] font-bold tracking-[0.22em] uppercase text-[var(--text-label)] mb-0.5">
                  Attributes
                </p>
                {stats.map((attr, index) => {
                  const width = Math.min(100, Math.max(0, (attr.value / 99) * 100));
                  return (
                    <div
                      key={attr.key}
                      className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 min-w-0 rounded-xl border border-white/[0.08] bg-black px-3 py-3 sm:px-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
                    >
                      <div className="flex shrink-0 items-baseline justify-between gap-4 sm:flex-col sm:justify-center sm:w-[12rem] lg:w-[13rem]">
                        <p className="text-base font-semibold text-white/90 leading-tight">{attr.fullName}</p>
                        <p
                          className="text-xl font-black font-mono tabular-nums text-right lg:text-[1.35rem]"
                          style={{ color: attr.color }}
                        >
                          {attr.value}
                        </p>
                      </div>
                      <div className="flex-1 min-w-0 tier-card-stat-track h-3 overflow-hidden border border-white/[0.06] rounded-full">
                        <div
                          className="h-full rounded-full transition-[width] duration-700 ease-out gpu-bar-grow"
                          style={{
                            width: `${width}%`,
                            background: attr.color,
                            transitionDelay: `${index * 55}ms`,
                            boxShadow: "0 0 12px rgba(255,255,255,0.12)",
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {heroArtSlot}
          </div>
        )}
      </div>
    </div>
  );
}

export default memo(TierCard);
