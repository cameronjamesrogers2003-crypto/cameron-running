import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { fetchHistoricalWeather, BRISBANE_LAT, BRISBANE_LON } from "@/lib/weather";
import { requireInternalApiAuth } from "@/lib/apiAuth";

const BATCH_SIZE    = 10;
const BATCH_DELAY   = 1000; // ms between batches

export async function GET(req: NextRequest) {
  const authResp = requireInternalApiAuth(req);
  if (authResp) return authResp;
  try {
    const activities = await prisma.activity.findMany({
      where:   { temperatureC: null },
      orderBy: { date: "desc" },
      select:  { id: true, date: true, startLat: true, startLon: true },
    });

    let processed = 0;
    let failed    = 0;
    let skipped   = 0;

    for (let i = 0; i < activities.length; i += BATCH_SIZE) {
      const batch = activities.slice(i, i + BATCH_SIZE);

      await Promise.all(
        batch.map(async (act) => {
          if (!act.date) { skipped++; return; }

          const lat = act.startLat ?? BRISBANE_LAT;
          const lon = act.startLon ?? BRISBANE_LON;

          const weather = await fetchHistoricalWeather(lat, lon, new Date(act.date));

          if (weather) {
            await prisma.activity.update({
              where: { id: act.id },
              data:  { temperatureC: weather.temperatureC, humidityPct: weather.humidityPct },
            });
            processed++;
          } else {
            console.warn(`[backfill] ✗ ${act.id}  no data`);
            failed++;
          }
        })
      );

      if (activities.length - i - BATCH_SIZE > 0) {
        await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY));
      }
    }

    return NextResponse.json({ processed, failed, skipped });
  } catch (err) {
    console.error("[weather/backfill] failed:", err);
    return NextResponse.json({ error: "Failed to backfill weather" }, { status: 500 });
  }
}
