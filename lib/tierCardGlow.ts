/**
 * Shared collectible tier outer glow strings (PNG card art + ambient layers).
 * The Running Card shell border/bloom reads hex from each tier's `accentColor` in `playerCardTiers.ts`.
 */
export function tierGlowPair(
  ring: string,
  auraMid: string,
  auraWide: string,
  ringHover: string,
  auraMidHover: string,
  auraWideHover: string,
): { glowShadow: string; glowShadowHover: string } {
  const lift = "0 10px 32px rgba(0,0,0,0.52)";
  const liftHover = "0 14px 40px rgba(0,0,0,0.58)";
  return {
    glowShadow: `0 0 0 1px ${ring}, ${lift}, 0 0 36px ${auraMid}, 0 0 56px ${auraWide}`,
    glowShadowHover: `0 0 0 1px ${ringHover}, ${liftHover}, 0 0 44px ${auraMidHover}, 0 0 72px ${auraWideHover}`,
  };
}
