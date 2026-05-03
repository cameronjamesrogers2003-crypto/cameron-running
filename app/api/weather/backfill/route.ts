import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { fetchHistoricalWeather, BRISBANE_LAT, BRISBANE_LON } from "@/lib/weather";

const BATCH_SIZE    = 10;
const BATCH_DELAY   = 1000; // ms between batches

export async function GET() {
  const activities = await prisma.activity.findMany({
    where:   { temperatureC: null },
    orderBy: { date: "desc" },
    select:  { id: true, date: true, startLat: true, startLon: true },
  });

  console.log(`[backfill] ${activities.length} activities need weather data`);

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
          console.log(`[backfill] ✓ ${act.id}  ${weather.temperatureC}°C  ${weather.humidityPct}%`);
          processed++;
        } else {
          console.warn(`[backfill] ✗ ${act.id}  no data`);
          failed++;
        }
      })
    );

    const remaining = activities.length - i - BATCH_SIZE;
    if (remaining > 0) {
      console.log(`[backfill] batch done — ${remaining} remaining, waiting ${BATCH_DELAY}ms`);
      await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY));
    }
  }

  console.log(`[backfill] complete — processed: ${processed}, failed: ${failed}, skipped: ${skipped}`);
  return NextResponse.json({ processed, failed, skipped });
}
