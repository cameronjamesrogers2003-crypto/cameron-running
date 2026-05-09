/** Tier illustration under `public/player-cards/` — PNGs use native black backgrounds; do not process. */
import { tierGlowPair } from "@/lib/tierCardGlow";

export type TierConfig = {
  min: number;
  max: number;
  name: string;
  /** Path under `public/` for next/image */
  cardArt: string;
  /** Edge / ambient glow (box-shadow layers, no filter on PNG) */
  glowShadow: string;
  glowShadowHover: string;
  /** Thin rim highlight */
  rimLight: string;
  cardBg: string;
  accentColor: string;
  accentDim: string;
  borderColor: string;
  ovrColor: string;
  shimmer: boolean;
  patternOpacity: number;
};

const NW = tierGlowPair(
  "rgba(255,255,255,0.1)",
  "rgba(255,255,255,0.1)",
  "rgba(160,160,170,0.06)",
  "rgba(255,255,255,0.16)",
  "rgba(255,255,255,0.14)",
  "rgba(190,190,200,0.09)",
);

const BB = tierGlowPair(
  "rgba(205,127,50,0.28)",
  "rgba(205,127,50,0.2)",
  "rgba(160,85,30,0.08)",
  "rgba(205,127,50,0.38)",
  "rgba(205,127,50,0.28)",
  "rgba(180,95,40,0.12)",
);

const DR = tierGlowPair(
  "rgba(74,222,128,0.28)",
  "rgba(74,222,128,0.2)",
  "rgba(34,160,80,0.08)",
  "rgba(74,222,128,0.4)",
  "rgba(74,222,128,0.3)",
  "rgba(52,190,130,0.11)",
);

const CP = tierGlowPair(
  "rgba(96,165,250,0.3)",
  "rgba(96,165,250,0.22)",
  "rgba(59,130,246,0.09)",
  "rgba(96,165,250,0.42)",
  "rgba(96,165,250,0.32)",
  "rgba(96,165,250,0.12)",
);

const EA = tierGlowPair(
  "rgba(167,139,250,0.32)",
  "rgba(167,139,250,0.22)",
  "rgba(124,92,246,0.09)",
  "rgba(167,139,250,0.45)",
  "rgba(167,139,250,0.32)",
  "rgba(139,92,246,0.12)",
);

const WC = tierGlowPair(
  "rgba(251,191,36,0.34)",
  "rgba(251,191,36,0.24)",
  "rgba(200,140,30,0.1)",
  "rgba(251,191,36,0.48)",
  "rgba(251,191,36,0.34)",
  "rgba(245,180,50,0.14)",
);

export const TIERS: TierConfig[] = [
  {
    min: 1, max: 20,
    name: "Newcomer",
    cardArt: "/player-cards/newcomer.png",
    ...NW,
    rimLight: "rgba(255,255,255,0.06)",
    cardBg: "linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 50%, #1a1a1a 100%)",
    accentColor: "#9ca3af",
    accentDim: "rgba(156,163,175,0.15)",
    borderColor: "rgba(156,163,175,0.25)",
    ovrColor: "#9ca3af",
    shimmer: false,
    patternOpacity: 0.03,
  },
  {
    min: 21, max: 40,
    name: "Building Base",
    cardArt: "/player-cards/building-base.png",
    ...BB,
    rimLight: "rgba(205,127,50,0.11)",
    cardBg: "linear-gradient(135deg, #1c1007 0%, #2d1a0a 40%, #1c1007 100%)",
    accentColor: "#cd7f32",
    accentDim: "rgba(205,127,50,0.15)",
    borderColor: "rgba(205,127,50,0.30)",
    ovrColor: "#cd7f32",
    shimmer: false,
    patternOpacity: 0.04,
  },
  {
    min: 41, max: 60,
    name: "Developing Runner",
    cardArt: "/player-cards/developing-runner.png",
    ...DR,
    rimLight: "rgba(74,222,128,0.1)",
    cardBg: "linear-gradient(135deg, #0a1a0f 0%, #0f2a18 40%, #0a1a0f 100%)",
    accentColor: "#4ade80",
    accentDim: "rgba(74,222,128,0.15)",
    borderColor: "rgba(74,222,128,0.30)",
    ovrColor: "#4ade80",
    shimmer: false,
    patternOpacity: 0.05,
  },
  {
    min: 61, max: 75,
    name: "Competitive",
    cardArt: "/player-cards/competitive.png",
    ...CP,
    rimLight: "rgba(96,165,250,0.1)",
    cardBg: "linear-gradient(135deg, #0a0f1a 0%, #0f1a2d 40%, #0a0f1a 100%)",
    accentColor: "#60a5fa",
    accentDim: "rgba(96,165,250,0.15)",
    borderColor: "rgba(96,165,250,0.35)",
    ovrColor: "#60a5fa",
    shimmer: false,
    patternOpacity: 0.06,
  },
  {
    min: 76, max: 89,
    name: "Elite Amateur",
    cardArt: "/player-cards/elite-amateur.png",
    ...EA,
    rimLight: "rgba(167,139,250,0.11)",
    cardBg: "linear-gradient(135deg, #0f0a1a 0%, #1a0f2d 40%, #0f0a1a 100%)",
    accentColor: "#a78bfa",
    accentDim: "rgba(167,139,250,0.15)",
    borderColor: "rgba(167,139,250,0.40)",
    ovrColor: "#a78bfa",
    shimmer: true,
    patternOpacity: 0.08,
  },
  {
    min: 90, max: 99,
    name: "World Class",
    cardArt: "/player-cards/world-class.png",
    ...WC,
    rimLight: "rgba(251,191,36,0.12)",
    cardBg: "linear-gradient(135deg, #1a1200 0%, #2d2000 30%, #1a1500 60%, #2d2000 100%)",
    accentColor: "#fbbf24",
    accentDim: "rgba(251,191,36,0.20)",
    borderColor: "rgba(251,191,36,0.50)",
    ovrColor: "#fbbf24",
    shimmer: true,
    patternOpacity: 0.12,
  },
];

export function getTier(ovr: number): TierConfig {
  return TIERS.find((t) => ovr >= t.min && ovr <= t.max) ?? TIERS[0];
}
