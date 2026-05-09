"use client";

import Image from "next/image";
import type { CSSProperties, ReactNode } from "react";
import { memo, useMemo } from "react";
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

/** Shared layout tokens — premium rhythm without changing column architecture */
const LEFT_PANEL =
  "relative flex flex-col flex-1 min-w-0 bg-gradient-to-br from-white/[0.035] via-transparent to-transparent";

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
    "--tier-accent": tier.accentColor,
  } as CSSProperties;

  const accentIcon =
    badge ?? (
      <Trophy
        className="w-4 h-4 sm:w-5 sm:h-5 shrink-0 opacity-90"
        style={{
          color: tier.accentColor,
          filter: `drop-shadow(0 0 10px color-mix(in srgb, ${tier.accentColor} 40%, transparent))`,
        }}
        strokeWidth={2}
        aria-hidden
      />
    );

  const shimmerLayer =
    tier.shimmer ? (
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-[3] h-[46%] opacity-[0.2] mix-blend-overlay overflow-hidden rounded-t-3xl"
        style={{
          background:
            "linear-gradient(100deg, transparent 0%, rgba(255,255,255,0.07) 46%, transparent 78%)",
          animation: "rs-shimmer 5.5s ease-in-out infinite",
        }}
      />
    ) : null;

  const isCompact = variant === "compact";

  const artZoneStyle = useMemo(() => ({ "--tier-accent": tier.accentColor }) as CSSProperties, [tier.accentColor]);

  const artShellClass = isCompact
    ? [
        "tier-card-art-zone relative overflow-hidden shrink-0",
        "flex flex-col items-stretch justify-end",
        "min-h-[152px] sm:min-h-[168px] md:min-h-0",
        "md:w-[min(46vw,264px)] lg:w-[min(46vw,292px)]",
        "border-t border-white/[0.07] md:border-t-0 md:border-l md:border-white/[0.07]",
      ].join(" ")
    : [
        "tier-card-art-zone relative overflow-hidden shrink-0",
        "flex flex-col items-stretch justify-end",
        "min-h-[196px] sm:min-h-[220px] md:min-h-0",
        "md:w-[min(44vw,380px)] md:min-w-[280px] lg:min-w-[308px] xl:min-w-[328px]",
        "border-t border-white/[0.07] md:border-t-0 md:border-l md:border-white/[0.07]",
      ].join(" ");

  const imagePad = isCompact ? "p-4 pb-5 sm:p-5 md:p-6 md:pb-7" : "p-5 pb-6 sm:p-7 md:p-8 md:pb-10 lg:pb-11";

  const imageClass = isCompact
    ? [
        "relative z-[2] pointer-events-none select-none h-auto w-full mx-auto md:mx-0",
        "max-h-[156px] sm:max-h-[176px] md:max-h-[212px] lg:max-h-[236px]",
        "max-w-[200px] sm:max-w-[220px] md:max-w-[272px]",
        "object-contain object-bottom object-right",
        "opacity-[0.96] [filter:drop-shadow(0_12px_28px_rgba(0,0,0,0.55))]",
      ].join(" ")
    : [
        "relative z-[2] pointer-events-none select-none h-auto w-full",
        "max-h-[248px] sm:max-h-[288px] md:max-h-[348px] lg:max-h-[392px] xl:max-h-[420px]",
        "max-w-[min(100%,340px)] md:max-w-[min(100%,380px)] lg:max-w-[400px] ml-auto",
        "object-contain object-bottom object-right",
        "opacity-[0.97] [filter:drop-shadow(0_16px_40px_rgba(0,0,0,0.5))]",
      ].join(" ");

  const imageSizes = isCompact
    ? "(max-width: 768px) 240px, 300px"
    : "(max-width: 768px) 280px, (max-width: 1200px) 380px, 420px";

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
    <div className="rounded-xl border border-white/[0.09] bg-black/25 px-3 py-2.5 backdrop-blur-[6px] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
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
            className="text-[11px] font-bold pb-0.5 px-2 py-1 rounded-md bg-white/[0.06] border border-white/[0.06]"
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
    <div className="rounded-2xl border border-white/[0.09] bg-black/30 px-4 py-3 sm:px-5 sm:py-4 backdrop-blur-[8px] shadow-[inset_0_1px_0_rgba(255,255,255,0.07)] max-w-md">
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
        <div className="flex-1 min-w-[9rem] pt-1 border-l border-white/[0.08] pl-5 sm:pl-6">
          <p className="text-[11px] font-semibold text-white/75 leading-snug">
            <span className="text-[var(--text-label)] uppercase tracking-[0.14em] text-[10px] font-bold block mb-1">
              Tier
            </span>
            <span style={{ color: tier.accentColor }}>{tier.name}</span>
          </p>
          {prevRank !== undefined && rank !== prevRank && (
            <p
              className="text-sm font-bold mt-3 px-2.5 py-1.5 rounded-lg inline-block bg-white/[0.06] border border-white/[0.07]"
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
    <div className={artShellClass} style={artZoneStyle}>
      <div className="tier-card-art-zone__bg" aria-hidden />
      <div className="tier-card-art-zone__floor" aria-hidden />
      <div className={`relative z-[2] flex flex-1 items-end justify-end ${imagePad}`}>{artwork}</div>
    </div>
  );

  return (
    <div
      role="article"
      className="tier-card-shell rounded-3xl hover:-translate-y-0.5 hover:scale-[1.003] motion-reduce:hover:translate-y-0 motion-reduce:hover:scale-100"
      style={glowVars}
    >
      <div
        className="relative rounded-3xl bg-[#030303] overflow-hidden border border-white/[0.08]"
        style={{ boxShadow: `inset 0 1px 0 ${tier.rimLight}` }}
      >
        <div className="tier-card-inner-vignette" aria-hidden />
        {shimmerLayer}

        {isCompact ? (
          <div className="relative z-[2] flex flex-col md:flex-row md:items-stretch min-h-0">
            <div className={`${LEFT_PANEL} gap-3.5 p-4 sm:p-5 md:pr-6 md:py-6`}>
              {runningCardRow}
              <p className="text-sm sm:text-[15px] font-black tracking-[0.05em] text-white break-words drop-shadow-sm">
                {name}
              </p>
              <p
                className="text-[11px] sm:text-xs font-bold uppercase tracking-[0.18em]"
                style={{ color: tier.accentColor }}
              >
                {tier.name}
              </p>
              {ovrBlockCompact}
              <div className="rounded-full tier-card-stat-track max-w-xs overflow-hidden border border-white/[0.06]">
                <div
                  className="h-full rounded-full transition-[width] duration-700 ease-out shadow-[0_0_14px_color-mix(in_srgb,var(--tier-accent)_28%,transparent)]"
                  style={{ width: `${bandPct}%`, background: tier.accentColor }}
                />
              </div>
              <div className="grid grid-cols-5 gap-2 pt-2">
                {stats.map((attr) => (
                  <div
                    key={attr.key}
                    className="min-w-0 rounded-lg border border-white/[0.07] bg-white/[0.03] px-1.5 py-2 text-center md:text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
                  >
                    <p className="text-[8px] sm:text-[9px] font-bold tracking-[0.14em] text-[var(--text-label)] truncate">
                      {attr.key}
                    </p>
                    <p
                      className="text-xs sm:text-sm font-black font-mono tabular-nums leading-tight mt-1"
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
            <div className={`${LEFT_PANEL} gap-4 sm:gap-5 p-5 sm:p-6 lg:p-8 lg:pr-7`}>
              {runningCardRow}
              <p className="text-lg sm:text-xl font-black tracking-[0.06em] text-white break-words drop-shadow-sm">
                {name}
              </p>

              {ovrBlockFull}

              {showXp && (
                <div className="rounded-xl border border-white/[0.08] bg-black/25 px-4 py-3 space-y-2.5 max-w-lg backdrop-blur-[6px] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                  <div className="flex justify-between items-baseline gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--text-label)]">
                    <span>XP track</span>
                    <span className="text-white/70 normal-case tracking-normal font-semibold text-right">
                      {pointsToNext} pts to {nextTierName}
                    </span>
                  </div>
                  <div className="tier-card-stat-track overflow-hidden border border-white/[0.06]">
                    <div
                      className="h-full rounded-full transition-[width] duration-700 ease-out shadow-[0_0_16px_color-mix(in_srgb,var(--tier-accent)_22%,transparent)]"
                      style={{ width: `${bandPct}%`, background: tier.accentColor }}
                    />
                  </div>
                  <p className="text-[11px] text-[var(--text-dim)] leading-snug">
                    Progress within {tier.name} band ({tier.min}–{tier.max} OVR)
                  </p>
                </div>
              )}

              <div className="mt-auto pt-6 border-t border-white/[0.07] space-y-2.5 w-full max-w-xl">
                <p className="text-[10px] font-bold tracking-[0.22em] uppercase text-[var(--text-label)] mb-1">
                  Attributes
                </p>
                {stats.map((attr, index) => {
                  const width = Math.min(100, Math.max(0, (attr.value / 99) * 100));
                  return (
                    <div
                      key={attr.key}
                      className="flex items-center gap-2.5 sm:gap-3 min-w-0 rounded-xl border border-white/[0.06] bg-white/[0.025] px-2.5 py-2 sm:px-3 sm:py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
                    >
                      <span className="w-9 sm:w-10 shrink-0 text-[10px] font-extrabold tracking-[0.08em] text-white/90">
                        {attr.key}
                      </span>
                      <div className="flex-1 min-w-0 tier-card-stat-track overflow-hidden border border-white/[0.05]">
                        <div
                          className="h-full rounded-full transition-[width] duration-700 ease-out gpu-bar-grow"
                          style={{
                            width: `${width}%`,
                            background: attr.color,
                            transitionDelay: `${index * 55}ms`,
                            boxShadow: "0 0 14px rgba(255,255,255,0.08)",
                          }}
                        />
                      </div>
                      <span
                        className="w-8 sm:w-9 shrink-0 text-sm font-black font-mono tabular-nums text-right text-white"
                        style={{ color: attr.color }}
                      >
                        {attr.value}
                      </span>
                      <span className="hidden sm:block w-[5.5rem] lg:w-28 shrink-0 text-[10px] font-medium tracking-wide text-[var(--text-muted)] truncate text-right">
                        {attr.fullName}
                      </span>
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
