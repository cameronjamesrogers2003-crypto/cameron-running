import type { PrismaClient } from "@prisma/client";
import {
  calculateRunRating,
  ratingBand,
  type StatActivity,
} from "@/lib/rating";
import { dbSettingsToUserSettings, DEFAULT_SETTINGS, type UserSettings } from "@/lib/settings";
import { loadGeneratedPlan } from "@/lib/planStorage";
import { getEffectivePlanStart, parsePlanFirstSessionDay } from "@/lib/planUtils";
import {
  enhancedClassifyRun,
  getPlanContextForDate,
} from "@/lib/runClassification";
import { getDynamicLongRunThresholdKm } from "@/lib/longRunThreshold";

function toStat(a: {
  id: string;
  date: Date;
  distanceKm: number;
  avgPaceSecKm: number;
  avgHeartRate: number | null;
  maxHeartRate: number | null;
  temperatureC: number | null;
  humidityPct: number | null;
  elevationGainM: number | null;
  classifiedRunType: string | null;
  splitsJson: string | null;
  durationSecs: number;
}): StatActivity {
  return {
    id: a.id,
    date: a.date,
    distanceKm: a.distanceKm,
    avgPaceSecKm: a.avgPaceSecKm,
    avgHeartRate: a.avgHeartRate,
    maxHeartRate: a.maxHeartRate,
    temperatureC: a.temperatureC,
    humidityPct: a.humidityPct,
    elevationGainM: a.elevationGainM,
    classifiedRunType: a.classifiedRunType,
    splitsJson: a.splitsJson,
    durationSecs: a.durationSecs,
  };
}

function effectiveType(
  a: StatActivity,
  settings: UserSettings,
  longRunThresholdKm?: number,
  longRunDistanceMethod?: string,
): string {
  return a.classifiedRunType
    ?? enhancedClassifyRun(
      {
        distanceKm: a.distanceKm,
        avgPaceSecKm: a.avgPaceSecKm,
        splitsJson: a.splitsJson ?? null,
      },
      settings,
      undefined,
      longRunThresholdKm,
      longRunDistanceMethod,
    ).runType;
}

/**
 * Recompute and persist `rating` + `classifiedRunType` for one activity.
 * Uses the last 10 prior runs of the same classified type (excluding this row).
 */
export async function persistActivityRating(
  prisma: PrismaClient,
  activityId: string,
  longRunThresholdKm?: number,
  longRunDistanceMethod?: string,
): Promise<void> {
  const [settingsRow, act, generatedPlan] = await Promise.all([
    prisma.userSettings.findUnique({ where: { id: 1 } }),
    prisma.activity.findUnique({ where: { id: activityId } }),
    loadGeneratedPlan(),
  ]);

  if (!act || !["running", "trail_running"].includes(act.activityType)) return;

  const settings = settingsRow ? dbSettingsToUserSettings(settingsRow) : DEFAULT_SETTINGS;

  let thresholdKm = longRunThresholdKm;
  let distanceMethod = longRunDistanceMethod;
  if (thresholdKm === undefined) {
    const res = await getDynamicLongRunThresholdKm(settings, prisma);
    thresholdKm = res.thresholdKm;
    distanceMethod = res.distanceLongMethod;
  } else if (distanceMethod === undefined) {
    distanceMethod =
      `Distance rule (>= ${Math.round(thresholdKm * 10) / 10}km · VDOT ${settings.currentVdot ?? 33} fallback · insufficient history)`;
  }

  const planStart = getEffectivePlanStart(settings.planStartDate, parsePlanFirstSessionDay(settings.trainingDays));
  const planContext = generatedPlan
    ? getPlanContextForDate(act.date, generatedPlan.plan, planStart)
    : undefined;
  const classification = enhancedClassifyRun(
    {
      distanceKm: act.distanceKm,
      avgPaceSecKm: act.avgPaceSecKm,
      splitsJson: act.splitsJson,
    },
    settings,
    planContext,
    thresholdKm,
    distanceMethod,
  );
  const classified = classification.runType;

  const prior = await prisma.activity.findMany({
    where: {
      activityType: { in: ["running", "trail_running"] },
      date:        { lt: act.date },
      id:          { not: activityId },
    },
    orderBy: { date: "desc" },
    take:    80,
    select:  {
      id: true,
      date: true,
      distanceKm: true,
      avgPaceSecKm: true,
      avgHeartRate: true,
      maxHeartRate: true,
      temperatureC: true,
      humidityPct: true,
      elevationGainM: true,
      classifiedRunType: true,
      splitsJson: true,
      durationSecs: true,
    },
  });

  const recentSameType: StatActivity[] = [];
  for (const r of prior) {
    const st = toStat(r);
    const t = effectiveType(st, settings, thresholdKm, distanceMethod);
    if (t === classified) {
      recentSameType.push({ ...st, classifiedRunType: t });
      if (recentSameType.length >= 10) break;
    }
  }

  // Most recent prior activity for fatigue context (Change 7)
  const priorActivity = prior.length > 0 ? toStat(prior[0]) : null;

  const stat = toStat({ ...act, classifiedRunType: classified });
  let ratingResult = calculateRunRating(stat, settings, recentSameType, priorActivity);

  // PB detection and score bump (Change 8)
  const allPriorStats = prior.map((r) => toStat(r));
  const personalBests: string[] = [];

  // Longest run PB
  const maxPriorDistance = allPriorStats.reduce((max, r) => Math.max(max, r.distanceKm), 0);
  if (allPriorStats.length > 0 && stat.distanceKm > maxPriorDistance) {
    personalBests.push("longestRun");
  }

  // Fastest pace PBs (interval / tempo / easy only — long pace PBs are ambiguous)
  if (classified === "interval" || classified === "tempo" || classified === "easy") {
    const sameTypePriors = allPriorStats.filter(
      (r) => effectiveType(r, settings, thresholdKm, distanceMethod) === classified,
    );
    const validPaces = sameTypePriors.map((r) => r.avgPaceSecKm).filter((p) => p > 0);
    if (validPaces.length > 0 && stat.avgPaceSecKm > 0) {
      const fastestPriorPace = Math.min(...validPaces);
      if (stat.avgPaceSecKm < fastestPriorPace) {
        const label = classified.charAt(0).toUpperCase() + classified.slice(1);
        personalBests.push(`fastest${label}`);
      }
    }
  }

  if (personalBests.length > 0) {
    const bumpedTotal = Math.round(Math.min(10, ratingResult.total + 0.3) * 10) / 10;
    const originalBand = ratingBand(ratingResult.total);
    const bumpedBand = ratingBand(bumpedTotal);
    const finalTotal = originalBand === bumpedBand ? bumpedTotal : ratingResult.total;
    ratingResult = { ...ratingResult, total: finalTotal, personalBests };
  }

  await prisma.activity.update({
    where: { id: activityId },
    data: {
      rating: ratingResult.total,
      ratingBreakdown: JSON.stringify(ratingResult),
      classifiedRunType: classified,
      classificationMethod: classification.method,
    },
  });
}
