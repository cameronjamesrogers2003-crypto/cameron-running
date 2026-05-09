import type { PrismaClient } from "@prisma/client";
import type { UserSettings } from "@/lib/settings";
import { loadGeneratedPlan } from "@/lib/planStorage";

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1]! + sorted[mid]!) / 2
    : sorted[mid]!;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function applyLevelBounds(
  raw: number,
  level: string | null | undefined,
): number {
  if (level === "BEGINNER") {
    return Math.round(clamp(raw, 8.0, 16.0) * 10) / 10;
  }
  if (level === "INTERMEDIATE") {
    return Math.round(clamp(raw, 11.0, 22.0) * 10) / 10;
  }
  // ADVANCED or unset
  return Math.round(clamp(raw, 14.0, 30.0) * 10) / 10;
}

// Conservative split point to separate short runs from long runs without
// using the threshold itself (avoids circular dependency)
function getConservativeSplit(
  level: string | null | undefined,
): number {
  if (level === "BEGINNER") return 9.0;
  if (level === "INTERMEDIATE") return 13.0;
  return 17.0; // ADVANCED
}

function getVdotBuffer(settings: UserSettings): number {
  const level = settings.experienceLevel;
  const vdot = settings.currentVdot ?? 33;

  const baseBuffer =
    level === "BEGINNER" ? 2.5
    : level === "INTERMEDIATE" ? 3.5
      : 4.5; // ADVANCED

  const vdotNorm = clamp((vdot - 20) / 65, 0, 1);
  const vdotBonus = vdotNorm * 1.5;

  return baseBuffer + vdotBonus;
}

function formatKmForMessage(km: number): string {
  return String(Math.round(km * 10) / 10);
}

/** Priority 3 — synchronous VDOT fallback (no DB). Used by rating pace fallback and classify when threshold not precomputed. */
export function getVdotFallbackLongRunThresholdKm(settings: UserSettings): number {
  const vdot = settings.currentVdot ?? 33;
  const vdotNorm = clamp((vdot - 20) / 65, 0, 1);
  const level = settings.experienceLevel;

  if (level === "BEGINNER") {
    return Math.round(
      clamp(8.0 + vdotNorm * 2.0, 8.0, 10.0) * 10,
    ) / 10;
  }
  if (level === "INTERMEDIATE") {
    return Math.round(
      clamp(11.0 + vdotNorm * 3.0, 11.0, 14.0) * 10,
    ) / 10;
  }
  return Math.round(
    clamp(14.0 + vdotNorm * 6.0, 14.0, 20.0) * 10,
  ) / 10;
}

export type DynamicLongRunThresholdResult = {
  thresholdKm: number;
  distanceLongMethod: string;
};

export async function getDynamicLongRunThresholdKm(
  settings: UserSettings,
  prisma: PrismaClient,
): Promise<DynamicLongRunThresholdResult> {
  const level = settings.experienceLevel;
  const conservativeSplit = getConservativeSplit(level);
  const buffer = getVdotBuffer(settings);
  const vdotForMsg = settings.currentVdot ?? 33;

  // ─────────────────────────────────────────
  // PRIORITY 1 — History-based
  // ─────────────────────────────────────────

  const cutoff28 = new Date();
  cutoff28.setDate(cutoff28.getDate() - 28);

  let recentRuns = await prisma.activity.findMany({
    where: {
      activityType: { in: ["running", "trail_running"] },
      date: { gte: cutoff28 },
      distanceKm: { gt: 0 },
    },
    orderBy: { date: "desc" },
    select: { distanceKm: true },
  });

  if (recentRuns.length < 3) {
    const cutoff56 = new Date();
    cutoff56.setDate(cutoff56.getDate() - 56);
    recentRuns = await prisma.activity.findMany({
      where: {
        activityType: { in: ["running", "trail_running"] },
        date: { gte: cutoff56 },
        distanceKm: { gt: 0 },
      },
      orderBy: { date: "desc" },
      select: { distanceKm: true },
    });
  }

  if (recentRuns.length >= 2) {
    const distances = recentRuns.map((r) => r.distanceKm);
    const shortRuns = distances.filter((d) => d < conservativeSplit);
    const baseDistance = shortRuns.length >= 2
      ? median(shortRuns)
      : median(distances);
    const rawThreshold = baseDistance + buffer;
    const thresholdKm = applyLevelBounds(rawThreshold, level);
    const n = shortRuns.length >= 2 ? shortRuns.length : distances.length;
    return {
      thresholdKm,
      distanceLongMethod:
        `Distance rule (>= ${formatKmForMessage(thresholdKm)}km · median of ${n} recent easy runs + buffer)`,
    };
  }

  // ─────────────────────────────────────────
  // PRIORITY 2 — Plan-based
  // ─────────────────────────────────────────

  try {
    const stored = await loadGeneratedPlan();
    if (stored?.plan?.length) {
      const planStart = new Date(
        settings.planStartDate ?? Date.now(),
      );
      const now = new Date();
      const weekNum = Math.max(
        1,
        Math.floor(
          (now.getTime() - planStart.getTime())
          / (7 * 24 * 60 * 60 * 1000),
        ) + 1,
      );

      const currentWeek = stored.plan.find((w) => w.week === weekNum)
        ?? stored.plan[0];

      const longSession = currentWeek?.sessions
        ?.find((s) => s.type === "long");

      if (longSession?.targetDistanceKm) {
        const planKm = longSession.targetDistanceKm;
        const planThreshold = planKm - 2.0;
        const thresholdKm = applyLevelBounds(planThreshold, level);
        return {
          thresholdKm,
          distanceLongMethod:
            `Distance rule (>= ${formatKmForMessage(thresholdKm)}km · planned long run ${formatKmForMessage(planKm)}km - 2km buffer)`,
        };
      }
    }
  } catch {
    // Plan not available — continue to fallback
  }

  // ─────────────────────────────────────────
  // PRIORITY 3 — VDOT fallback
  // ─────────────────────────────────────────

  const thresholdKm = getVdotFallbackLongRunThresholdKm(settings);
  return {
    thresholdKm,
    distanceLongMethod:
      `Distance rule (>= ${formatKmForMessage(thresholdKm)}km · VDOT ${vdotForMsg} fallback · insufficient history)`,
  };
}
