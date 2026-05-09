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

const INNER_BASE = "relative rounded-[calc(1.5rem-1px)] bg-black overflow-hidden";
const ART_PANEL =
  "relative flex shrink-0 flex-col bg-black overflow-hidden border-t border-white/[0.06] md:border-t-0 md:border-l md:border-white/[0.06]";
const STATS_ORDER = ["SPD", "END", "CON", "EFF", "TGH"] as const;

function orderedStats(stats: readonly TierCardStat[]): TierCardStat[] {
  const byKey = Object.fromEntries(stats.map((s) => [s.key, s]));
  return STATS_ORDER.map((k) => byKey[k]).filter(Boolean) as TierCardStat[];
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
        className="w-4 h-4 shrink-0 opacity-90 md:w-[1.05rem]"
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

  const imageClassCompactWidget = [
    "pointer-events-none select-none mix-blend-screen",
    "h-auto w-auto max-h-[200px] max-w-[min(100%,200px)]",
    "md:max-h-[min(260px,calc(100%-1rem))] md:max-w-[min(100%,220px)]",
    "object-contain object-center",
  ].join(" ");

  const imageClassFullHero = [
    "pointer-events-none select-none mix-blend-screen",
    "h-auto w-auto max-h-[min(340px,calc(50vh-80px))] max-w-[min(100%,360px)]",
    "sm:max-h-[380px] sm:max-w-[380px]",
    "object-contain object-center",
  ].join(" ");

  const artworkCompact = (
    <Image
      src={tier.cardArt}
      width={920}
      height={560}
      alt=""
      loading="lazy"
      sizes="(max-width: 768px) 220px, 260px"
      className={imageClassCompactWidget}
    />
  );

  const artworkFull = (
    <Image
      src={tier.cardArt}
      width={920}
      height={560}
      alt=""
      priority={variant === "full"}
      sizes="(max-width: 768px) 300px, 400px"
      className={imageClassFullHero}
    />
  );

  const rowStats = orderedStats(stats);
  const [s0, s1, s2, s3, s4] = rowStats;

  const tierBadgeChip = (
    <div
      className="inline-flex items-center gap-1.5 self-start rounded-lg border px-2.5 py-1"
      style={{ borderColor: `${tier.accentColor}55`, background: `${tier.accentColor}14` }}
    >
      <span className="text-[10px] font-bold uppercase tracking-wider md:text-[11px]" style={{ color: tier.accentColor }}>
        {tier.name}
      </span>
    </div>
  );

  const deltaCompact =
    prevRank !== undefined && rank !== prevRank ? (
      <span
        className="rounded-md border border-white/[0.08] bg-white/[0.06] px-2 py-0.5 text-[11px] font-bold whitespace-nowrap"
        style={{ color: rank > prevRank ? "#4ade80" : "#f87171" }}
      >
        {rank > prevRank ? "+" : ""}
        {rank - prevRank} OVR
      </span>
    ) : null;

  const deltaFull =
    prevRank !== undefined && rank !== prevRank ? (
      <p
        className="rounded-lg border border-white/[0.08] bg-white/[0.06] px-2.5 py-1.5 text-sm font-bold inline-block"
        style={{ color: rank > prevRank ? "#4ade80" : "#f87171" }}
      >
        {rank > prevRank ? "+" : ""}
        {rank - prevRank} since last sync
      </p>
    ) : null;

  const statCell = (s: TierCardStat | undefined) =>
    s ? (
      <div className={`flex min-w-0 items-center justify-between gap-2 border-b border-white/[0.07] py-1.5 last:border-b-0`}>
        <span className="truncate text-sm text-white/85">{s.fullName}</span>
        <span className="shrink-0 text-base font-bold tabular-nums font-mono" style={{ color: s.color }}>
          {s.value}
        </span>
      </div>
    ) : null;

  const compactInner = (
    <div className="relative z-[2]">
      {/* Mobile stack */}
      <div className="flex max-h-[min(520px,calc(100vh-240px))] flex-col gap-3 p-3.5 sm:p-4 md:hidden">
        <div className="min-w-0">
          <p className="truncate text-sm font-black tracking-tight text-white">{name}</p>
          <div className="mt-1.5">{tierBadgeChip}</div>
          <div className="mt-2 flex flex-wrap items-end gap-2">
            <span
              className="font-black leading-none tabular-nums tracking-tight"
              style={{ color: tier.ovrColor, fontSize: "2rem" }}
            >
              {showRank}
            </span>
            {deltaCompact}
          </div>
        </div>
        <div className="grid shrink-0 grid-cols-2 gap-x-3 gap-y-0">
          {statCell(s0)}
          {statCell(s1)}
          {statCell(s2)}
          {statCell(s3)}
          <div className="col-span-2">{statCell(s4)}</div>
        </div>
        <div className={`${ART_PANEL} flex min-h-[140px] flex-1 items-center justify-center border-t p-3`} style={accentVars}>
          {artworkCompact}
        </div>
      </div>

        {/* Dashboard grid — md+ */}
        <div
          className="relative z-[2] hidden max-h-[320px] min-h-[280px] grid-cols-[minmax(0,1fr)_minmax(148px,36%)] grid-rows-[auto,minmax(0,1fr)] gap-x-3 gap-y-2 overflow-hidden px-4 py-3 md:grid"
        >
          <div className="col-start-1 row-start-1 flex min-h-0 min-w-0 flex-col gap-1.5 self-start pb-1">
            <p className="truncate text-sm font-black tracking-tight text-white">{name}</p>
            {tierBadgeChip}
            <div className="mt-1 flex flex-wrap items-end gap-2">
              <span
                className="font-black leading-none tabular-nums tracking-tight"
                style={{ color: tier.ovrColor, fontSize: "2rem" }}
              >
                {showRank}
              </span>
              {deltaCompact}
            </div>
          </div>

          <div className="col-start-1 row-start-2 min-h-0 min-w-0 overflow-auto pr-1">
            <div className="grid min-h-0 grid-cols-2 content-start gap-x-3">
              {statCell(s0)}
              {statCell(s1)}
              {statCell(s2)}
              {statCell(s3)}
              <div className="col-span-2">{statCell(s4)}</div>
            </div>
          </div>

          <div
            className="col-start-2 row-span-2 row-start-1 flex items-center justify-center border-l border-white/[0.06] p-2"
            style={accentVars}
          >
            {artworkCompact}
          </div>
        </div>
    </div>
  );

  const fullInner = (
    <div className="relative z-[2] grid min-h-0 grid-cols-1 gap-5 p-5 sm:p-6 md:min-h-[380px] md:grid-cols-[minmax(0,45%)_minmax(0,55%)] md:items-stretch md:gap-6 lg:p-7">
      {/* Left — identity + OVR + XP */}
      <div className="flex min-h-0 flex-col gap-4 md:h-full md:min-h-0">
        <div className="flex items-center gap-2 min-w-0">
          {accentIcon}
          <span className="text-[10px] font-bold tracking-[0.22em] uppercase text-[var(--text-label)] truncate">
            Running card
          </span>
        </div>
        <p className="text-sm font-black tracking-wide text-white break-words sm:text-base">{name}</p>

        <div>
          <p
            className="font-black leading-[0.95] font-mono tabular-nums tracking-tight"
            style={{ color: tier.ovrColor, fontSize: "clamp(2.75rem,8vw,4.25rem)" }}
          >
            {showRank}
          </p>
          <p className="mt-2 text-[10px] font-bold tracking-[0.2em] text-[var(--text-label)]">RANK · OVR</p>
        </div>

        {tierBadgeChip}

        {deltaFull}

        {showXp && (
          <div className="rounded-xl border border-white/[0.1] bg-black px-4 py-3 space-y-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
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
      </div>

      {/* Right — art upper, stats lower */}
      <div className={`${ART_PANEL} flex min-h-[320px] flex-col rounded-none md:h-full md:min-h-0`} style={accentVars}>
        <div className="flex min-h-[45%] flex-1 items-center justify-center px-4 py-4 md:py-6">
          {artworkFull}
        </div>
        <div className="flex shrink-0 flex-col border-t border-white/[0.08] px-4 py-3 md:px-5 md:pb-5">
          {rowStats.map((attr) => (
            <div
              key={attr.key}
              className="flex items-center justify-between gap-4 border-b border-white/[0.08] py-3 last:border-b-0 first:pt-0"
            >
              <span className="min-w-0 flex-1 text-base font-semibold text-white/90">{attr.fullName}</span>
              <span className="shrink-0 text-lg font-black tabular-nums font-mono" style={{ color: attr.color }}>
                {attr.value}
              </span>
            </div>
          ))}
        </div>
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
      <div className={INNER_BASE} style={{ boxShadow: `inset 0 1px 0 ${tier.rimLight}` }}>
        {shimmerLayer}
        {isCompact ? compactInner : fullInner}
      </div>
    </div>
  );
}

export default memo(TierCard);
