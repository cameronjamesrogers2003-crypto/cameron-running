"use client";

import { useEffect, useMemo, useState, memo } from "react";
import { getTier, TIERS } from "@/lib/playerCardTiers";
import TierCard from "@/components/TierCard";

interface PlayerCardProps {
  ovr: number;
  name: string;
  spd: number;
  end: number;
  res: number;
  eff: number;
  tgh: number;
  prevOvr?: number;
  mode?: "dashboard" | "full";
}

function PlayerCard({
  ovr,
  name,
  spd,
  end,
  res,
  eff,
  tgh,
  prevOvr,
  mode = "dashboard",
}: PlayerCardProps) {
  const tier = getTier(ovr);
  const rank = Math.round(ovr);
  const stats = useMemo(
    () =>
      [
        { key: "SPD", fullName: "Speed", value: spd, color: "var(--c-interval)" },
        { key: "END", fullName: "Endurance", value: end, color: "var(--c-long)" },
        { key: "RES", fullName: "Resilience", value: res, color: "var(--c-tempo)" },
        { key: "EFF", fullName: "HR Efficiency", value: eff, color: "var(--c-easy)" },
        { key: "TGH", fullName: "Toughness", value: tgh, color: "#f5b454" },
      ] as const,
    [spd, end, res, eff, tgh],
  );

  const isDashboard = mode === "dashboard";
  const [animatedRank, setAnimatedRank] = useState(0);

  useEffect(() => {
    if (isDashboard) return;
    const target = rank;
    let step = 0;
    const interval = setInterval(() => {
      step += 1;
      setAnimatedRank(Math.round((step / 40) * target));
      if (step >= 40) clearInterval(interval);
    }, 20);
    return () => clearInterval(interval);
  }, [rank, isDashboard]);

  const tierIdx = Math.max(0, TIERS.findIndex((t) => t.name === tier.name));
  const nextTier = TIERS[tierIdx + 1] ?? null;
  const pointsToNext = nextTier ? Math.max(0, nextTier.min - rank) : null;

  return (
    <TierCard
      tier={tier}
      name={name}
      rank={rank}
      displayRank={isDashboard ? rank : animatedRank}
      stats={stats}
      prevRank={prevOvr !== undefined ? Math.round(prevOvr) : undefined}
      variant={isDashboard ? "compact" : "full"}
      pointsToNext={pointsToNext}
      nextTierName={nextTier?.name ?? null}
    />
  );
}

export default memo(PlayerCard);
