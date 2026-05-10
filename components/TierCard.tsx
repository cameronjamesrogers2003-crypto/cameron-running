"use client";

import Image from "next/image";
import type { CSSProperties, ReactNode } from "react";
import { memo, useCallback, useMemo, useState } from "react";
import { Trophy } from "lucide-react";
import type { TierConfig } from "@/lib/playerCardTiers";
import { getTierGlowHex, tierShellBoxShadow } from "@/lib/playerCardTiers";

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

const INNER_BASE = "relative rounded-[calc(1.5rem-1px)] overflow-hidden bg-black";
const STATS_ORDER = ["SPD", "END", "RES", "EFF", "TGH"] as const;

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

  // No mix-blend-screen: art panel is pure #000 so PNG black backgrounds disappear naturally.
  const imageClassCompact = [
    "pointer-events-none select-none",
    "h-auto w-auto max-h-[200px] max-w-[min(100%,210px)]",
    "md:max-h-[min(280px,100%)] md:max-w-[min(100%,280px)]",
    "object-contain object-center",
  ].join(" ");

  const imageClassFull = [
    "pointer-events-none select-none",
    "h-auto w-auto max-h-[min(380px,calc(55vh-60px))] max-w-[min(100%,400px)]",
    "sm:max-h-[440px] sm:max-w-[440px]",
    "object-contain object-center",
  ].join(" ");

  const artworkCompact = (
    <Image
      src={tier.cardArt}
      width={920}
      height={560}
      alt=""
      loading="lazy"
      sizes="(max-width: 768px) 220px, 280px"
      className={imageClassCompact}
    />
  );

  const artworkFull = (
    <Image
      src={tier.cardArt}
      width={920}
      height={560}
      alt=""
      priority={variant === "full"}
      sizes="(max-width: 768px) 360px, 440px"
      className={imageClassFull}
    />
  );

  const rowStats = orderedStats(stats);

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
        className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-bold whitespace-nowrap"
        style={{
          background: rank > prevRank ? "rgba(74,222,128,0.1)" : "rgba(248,113,113,0.1)",
          borderColor: rank > prevRank ? "rgba(74,222,128,0.3)" : "rgba(248,113,113,0.3)",
          color: rank > prevRank ? "#4ade80" : "#f87171",
        }}
      >
        {rank > prevRank ? "+" : ""}
        {rank - prevRank} OVR
      </span>
    ) : null;

  const deltaFull =
    prevRank !== undefined && rank !== prevRank ? (
      <span
        className="inline-flex items-center rounded-full border px-3 py-1 text-sm font-bold"
        style={{
          background: rank > prevRank ? "rgba(74,222,128,0.1)" : "rgba(248,113,113,0.1)",
          borderColor: rank > prevRank ? "rgba(74,222,128,0.3)" : "rgba(248,113,113,0.3)",
          color: rank > prevRank ? "#4ade80" : "#f87171",
        }}
      >
        {rank > prevRank ? "+" : ""}
        {rank - prevRank} since last sync
      </span>
    ) : null;

  // ── Compact variant ────────────────────────────────────────────────────────

  const compactInner = (
    <div className="relative z-[2]">

      {/* Mobile: identity above, matte-black artwork below */}
      <div className="flex flex-col md:hidden">
        <div className="flex flex-col gap-2 p-4" style={{ background: tier.cardBg }}>
          <p className="truncate text-sm font-black tracking-tight text-white">{name}</p>
          {tierBadgeChip}
          <div className="flex flex-wrap items-end gap-2 pt-1">
            <span
              className="font-black leading-none tabular-nums tracking-tight"
              style={{ color: tier.ovrColor, fontSize: "3rem" }}
            >
              {showRank}
            </span>
            {deltaCompact}
          </div>
        </div>

        {/* Pure matte-black artwork zone — PNG background disappears */}
        <div className="relative flex min-h-[160px] flex-1 flex-col overflow-hidden" style={{ background: "#000" }}>
          {/* Feathered top edge — blends with identity section above */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 z-[2] h-8"
            style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, transparent 100%)" }}
          />
          <div className="relative z-[1] flex flex-1 items-center justify-center p-3">
            {artworkCompact}
          </div>
        </div>
      </div>

      {/* md+: identity left, artwork right — seamless matte black join */}
      <div className="hidden min-h-[260px] max-h-[300px] grid-cols-[minmax(0,1fr)_minmax(175px,48%)] grid-rows-1 overflow-hidden md:grid">

        {/* Left — name, tier badge, OVR */}
        <div
          className="relative col-start-1 flex min-h-0 min-w-0 flex-col justify-center gap-3 self-stretch overflow-hidden py-5 pl-5 pr-2"
          style={{ background: tier.cardBg }}
        >
          {/* Soft right-edge fade into the black art panel */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 right-0 z-[1] w-24"
            style={{ background: "linear-gradient(to right, transparent 0%, #000 100%)" }}
          />
          <div className="relative z-[2] flex min-w-0 flex-col gap-2">
            <p className="truncate text-sm font-black tracking-tight text-white">{name}</p>
            {tierBadgeChip}
            <div className="mt-1 flex flex-wrap items-end gap-2">
              <span
                className="font-black leading-none tabular-nums tracking-tight"
                style={{ color: tier.ovrColor, fontSize: "3rem" }}
              >
                {showRank}
              </span>
              {deltaCompact}
            </div>
          </div>
        </div>

        {/* Right — pure matte-black art zone, PNG background is invisible */}
        <div
          className="col-start-2 row-span-1 relative flex min-h-0 min-w-0 flex-col self-stretch overflow-hidden"
          style={{ ...accentVars, background: "#000" }}
        >
          {/* Left-edge feather — softens transition from identity column */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 left-0 z-[2] w-16"
            style={{ background: "linear-gradient(to right, rgba(0,0,0,0.7) 0%, transparent 100%)" }}
          />
          <div className="relative z-[1] flex flex-1 items-center justify-center p-2">
            {artworkCompact}
          </div>
        </div>
      </div>
    </div>
  );

  // ── Full variant ───────────────────────────────────────────────────────────

  const fullInner = (
    <div className="relative z-[2] flex min-h-0 flex-col md:flex-row md:items-stretch">

      {/* Left — identity + attributes + XP */}
      <div
        className="relative flex min-h-0 flex-col overflow-hidden p-5 sm:p-6 md:w-[43%] md:flex-shrink-0"
        style={{ background: tier.cardBg }}
      >
        {/* Right-edge fade — seamless join to matte-black art panel */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-0 z-[1] w-24 hidden md:block"
          style={{ background: "linear-gradient(to right, transparent 0%, #000 100%)" }}
        />

        <div className="relative z-[2] flex min-h-0 flex-1 flex-col gap-3">

          {/* Card header */}
          <div className="flex items-center gap-2 min-w-0">
            {accentIcon}
            <span className="text-[10px] font-bold tracking-[0.22em] uppercase text-[var(--text-label)] truncate">
              Running card
            </span>
          </div>

          {/* Name */}
          <p className="text-sm font-black tracking-wide text-white break-words sm:text-base">{name}</p>

          {/* OVR */}
          <div>
            <p
              className="font-black leading-[0.95] font-mono tabular-nums tracking-tight"
              style={{ color: tier.ovrColor, fontSize: "clamp(2.75rem,8vw,4.25rem)" }}
            >
              {showRank}
            </p>
            <p className="mt-1.5 text-[10px] font-bold tracking-[0.2em] text-[var(--text-label)]">RANK · OVR</p>
          </div>

          {tierBadgeChip}
          {deltaFull}

          {/* Attributes — label small/dim, value large/coloured */}
          <div className="mt-1 border-t border-white/[0.06] pt-2.5">
            {rowStats.map((attr) => (
              <div
                key={attr.key}
                className="flex items-center justify-between gap-3 border-b border-white/[0.05] py-2 last:border-b-0"
              >
                <span className="min-w-0 flex-1 text-xs font-medium tracking-wide text-white/50 uppercase">
                  {attr.fullName}
                </span>
                <span
                  className="shrink-0 text-xl font-black tabular-nums font-mono leading-none"
                  style={{ color: attr.color }}
                >
                  {attr.value}
                </span>
              </div>
            ))}
          </div>

          {/* XP bar — compact */}
          {showXp && (
            <div className="rounded-lg border border-white/[0.08] bg-black/50 px-3 py-2.5 space-y-2">
              <div className="flex justify-between items-baseline gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--text-label)]">
                <span>XP</span>
                <span className="text-white/55 normal-case tracking-normal font-semibold text-right text-[10px]">
                  {pointsToNext} pts → {nextTierName}
                </span>
              </div>
              <div className="tier-card-stat-track overflow-hidden border border-white/[0.07]">
                <div
                  className="h-full rounded-full transition-[width] duration-700 ease-out"
                  style={{
                    width: `${bandPct}%`,
                    background: tier.accentColor,
                    boxShadow: `0 0 12px ${tier.accentColor}44`,
                  }}
                />
              </div>
            </div>
          )}
        </div>

        <p className="relative z-[2] mt-4 shrink-0 text-[10px] tracking-widest uppercase text-white/15 select-none">
          Runshift
        </p>
      </div>

      {/* Right — pure matte-black artwork zone */}
      <div
        className="relative flex min-h-[260px] flex-1 flex-col md:min-h-0"
        style={{ ...accentVars, background: "#000" }}
      >
        {/* Left-edge feather — blends with left content column */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-0 z-[2] w-20 hidden md:block"
          style={{ background: "linear-gradient(to right, rgba(0,0,0,0.65) 0%, transparent 100%)" }}
        />
        {/* Top-edge feather on mobile — blends with content above */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 z-[2] h-10 md:hidden"
          style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.5) 0%, transparent 100%)" }}
        />

        {/* Artwork — centred in matte-black zone */}
        <div className="relative z-[1] flex flex-1 items-center justify-center px-4 py-6 md:py-10">
          {artworkFull}
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
