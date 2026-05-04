import type { PrismaClient } from "@prisma/client";
import {
  calculateRunRating,
  classifyRunByPaceZones,
  type StatActivity,
} from "@/lib/rating";
import { dbSettingsToUserSettings, DEFAULT_SETTINGS, type UserSettings } from "@/lib/settings";

function toStat(a: {
  id: string;
  date: Date;
  distanceKm: number;
  avgPaceSecKm: number;
  avgHeartRate: number | null;
  maxHeartRate: number | null;
  temperatureC: number | null;
  humidityPct: number | null;
  classifiedRunType: string | null;
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
    classifiedRunType: a.classifiedRunType,
  };
}

function effectiveType(a: StatActivity, settings: UserSettings): string {
  return classifyRunByPaceZones(
    a.avgPaceSecKm,
    a.distanceKm,
    settings.intervalPaceMaxSec,
    settings.tempoPaceMaxSec,
  );
}

/**
 * Recompute and persist `rating` + `classifiedRunType` for one activity.
 * Uses the last 10 prior runs of the same classified type (excluding this row).
 */
export async function persistActivityRating(
  prisma: PrismaClient,
  activityId: string,
): Promise<void> {
  const [settingsRow, act] = await Promise.all([
    prisma.userSettings.findUnique({ where: { id: 1 } }),
    prisma.activity.findUnique({ where: { id: activityId } }),
  ]);

  if (!act || !["running", "trail_running"].includes(act.activityType)) return;

  const settings = settingsRow ? dbSettingsToUserSettings(settingsRow) : DEFAULT_SETTINGS;

  const classified = classifyRunByPaceZones(
    act.avgPaceSecKm,
    act.distanceKm,
    settings.intervalPaceMaxSec,
    settings.tempoPaceMaxSec,
  );

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
      classifiedRunType: true,
    },
  });

  const recentSameType: StatActivity[] = [];
  for (const r of prior) {
    const st = toStat(r);
    const t = effectiveType(st, settings);
    if (t === classified) {
      recentSameType.push({ ...st, classifiedRunType: t });
      if (recentSameType.length >= 10) break;
    }
  }

  const stat = toStat({ ...act, classifiedRunType: classified });
  const ratingResult = calculateRunRating(stat, settings, recentSameType);

  await prisma.activity.update({
    where: { id: activityId },
    data: {
      rating: ratingResult.total,
      ratingBreakdown: JSON.stringify(ratingResult),
      classifiedRunType: classified,
    },
  });
}
