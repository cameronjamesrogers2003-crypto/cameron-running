import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getDynamicLongRunThresholdKm } from "@/lib/longRunThreshold";
import { persistActivityRating } from "@/lib/persistActivityRating";
import { recalculatePlayerRating } from "@/lib/playerRating";
import { dbSettingsToUserSettings, DEFAULT_SETTINGS } from "@/lib/settings";
import {
  fetchHistoricalWeather,
  BRISBANE_LAT,
  BRISBANE_LON,
} from "@/lib/weather";

export const dynamic = "force-dynamic";

/** GET/POST — recompute rating + classifiedRunType for every running activity (oldest first for stable medians). */
export async function GET(req: NextRequest) {
  return POST(req);
}

export async function POST(req: NextRequest) {
  void req;
  const settingsRow = await prisma.userSettings.findUnique({ where: { id: 1 } });
  const settings = settingsRow ? dbSettingsToUserSettings(settingsRow) : DEFAULT_SETTINGS;
  const { thresholdKm, distanceLongMethod } = await getDynamicLongRunThresholdKm(
    settings,
    prisma,
  );

  const ids = await prisma.activity.findMany({
    where: { activityType: { in: ["running", "trail_running"] } },
    orderBy: { date: "asc" },
    select: { id: true },
  });

  let ok = 0;
  let errors = 0;
  for (const { id } of ids) {
    try {
      await persistActivityRating(
        prisma,
        id,
        thresholdKm,
        distanceLongMethod,
      );
      ok++;
    } catch {
      errors++;
    }
  }

  const missingWeather = await prisma.activity.findMany({
    where: {
      temperatureC: null,
      activityType: { in: ["running", "trail_running"] },
    },
    select: {
      id: true,
      date: true,
      startLat: true,
      startLon: true,
    },
    orderBy: { date: "desc" },
  });

  let weatherFilled = 0;
  const weatherFilledIds: string[] = [];

  for (const act of missingWeather) {
    try {
      const weather = await fetchHistoricalWeather(
        act.startLat ?? BRISBANE_LAT,
        act.startLon ?? BRISBANE_LON,
        act.date,
      );
      if (weather) {
        await prisma.activity.update({
          where: { id: act.id },
          data: {
            temperatureC: weather.temperatureC,
            humidityPct: weather.humidityPct,
            weatherFetchedAt: new Date(),
          },
        });
        weatherFilled++;
        weatherFilledIds.push(act.id);
        console.log(
          `[backfill-weather] filled ${act.id}: ${weather.temperatureC}°C`,
        );
      }
    } catch (err) {
      console.warn(`[backfill-weather] failed for ${act.id}:`, err);
    }
    await new Promise((r) => setTimeout(r, 300));
  }

  let weatherReRated = 0;
  if (weatherFilledIds.length > 0) {
    for (const wid of weatherFilledIds) {
      try {
        await persistActivityRating(
          prisma,
          wid,
          thresholdKm,
          distanceLongMethod,
        );
        weatherReRated++;
      } catch {
        // non-fatal — rating will be updated on next sync
      }
    }
  }

  const playerRating = await recalculatePlayerRating(prisma);

  return NextResponse.json({
    updated: ok,
    errors,
    total: ids.length,
    weatherFilled,
    weatherReRated,
    playerRating,
  });
}
