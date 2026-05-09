/**
 * Accent used for collectible card border + outer bloom only.
 * Aligns tier names with app `lib/playerCardTiers.ts` (not alternate marketing names).
 */
export const TIER_GLOW_HEX: Record<string, `#${string}`> = {
  Newcomer: "#aaaaaa",
  "Building Base": "#3b82f6",
  "Developing Runner": "#22c55e",
  Competitive: "#f97316",
  "Elite Amateur": "#eab308",
  "World Class": "#a855f7",
};

export function getTierGlowHex(tierName: string): `#${string}` {
  return TIER_GLOW_HEX[tierName] ?? "#aaaaaa";
}

/** Supports #rgb and #rrggbb */
export function hexAlpha(hex: `#${string}`, alpha: number): string {
  const h = hex.slice(1);
  const expand = h.length === 3 ? [...h].map((c) => c + c).join("") : h;
  const r = Number.parseInt(expand.slice(0, 2), 16);
  const g = Number.parseInt(expand.slice(2, 4), 16);
  const b = Number.parseInt(expand.slice(4, 6), 16);
  if ([r, g, b].some((n) => Number.isNaN(n))) return `rgba(170,170,170,${alpha})`;
  return `rgba(${r},${g},${b},${alpha})`;
}

export function tierShellBoxShadow(hex: `#${string}`, hover: boolean): string {
  const innerA = hover ? 0.38 : 0.28;
  const outerA = hover ? 0.18 : 0.12;
  return `0 0 18px 4px ${hexAlpha(hex, innerA)}, 0 0 60px 12px ${hexAlpha(hex, outerA)}`;
}
