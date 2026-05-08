export type TierConfig = {
  min: number;
  max: number;
  name: string;
  cardBg: string;
  lightCardBg: string;
  accentColor: string;
  accentDim: string;
  borderColor: string;
  ovrColor: string;
  shimmer: boolean;
  patternOpacity: number;
};

export const TIERS: TierConfig[] = [
  {
    min: 1, max: 20,
    name: "Newcomer",
    cardBg: "linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 50%, #1a1a1a 100%)",
    lightCardBg: "linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%)",
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
    cardBg: "linear-gradient(135deg, #1c1007 0%, #2d1a0a 40%, #1c1007 100%)",
    lightCardBg: "linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)",
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
    cardBg: "linear-gradient(135deg, #0a1a0f 0%, #0f2a18 40%, #0a1a0f 100%)",
    lightCardBg: "linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)",
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
    cardBg: "linear-gradient(135deg, #0a0f1a 0%, #0f1a2d 40%, #0a0f1a 100%)",
    lightCardBg: "linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)",
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
    cardBg: "linear-gradient(135deg, #0f0a1a 0%, #1a0f2d 40%, #0f0a1a 100%)",
    lightCardBg: "linear-gradient(135deg, #faf5ff 0%, #ede9fe 100%)",
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
    cardBg: "linear-gradient(135deg, #1a1200 0%, #2d2000 30%, #1a1500 60%, #2d2000 100%)",
    lightCardBg: "linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)",
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
