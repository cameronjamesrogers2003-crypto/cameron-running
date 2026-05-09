import type { UserSettings } from "@/lib/settings";

/**
 * Minimum distance (km) that counts as a "long" run for pace-only rules,
 * scaled by experience level and VDOT. Used by run classification and rating fallback.
 */
export function getDynamicLongRunThresholdKm(settings: UserSettings): number {
  const level = settings.experienceLevel ?? "BEGINNER";
  const vdot = settings.currentVdot ?? 33;

  const baseThreshold =
    level === "BEGINNER" ? 6.0
    : level === "INTERMEDIATE" ? 10.0
      : 13.0;

  const vdotMin = 20;
  const vdotMax = 85;
  const vdotClamped = Math.max(vdotMin, Math.min(vdotMax, vdot));
  const vdotNorm = (vdotClamped - vdotMin) / (vdotMax - vdotMin);
  const vdotMultiplier = 0.8 + vdotNorm * 0.6;

  const dynamicThreshold = baseThreshold * vdotMultiplier;

  if (level === "BEGINNER") {
    return Math.round(Math.max(5, Math.min(10, dynamicThreshold)));
  }
  if (level === "INTERMEDIATE") {
    return Math.round(Math.max(9, Math.min(15, dynamicThreshold)));
  }
  return Math.round(Math.max(12, Math.min(20, dynamicThreshold)));
}
