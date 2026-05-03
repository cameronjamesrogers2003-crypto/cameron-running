import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { fetchHistoricalWeather, BRISBANE_LAT, BRISBANE_LON } from "@/lib/weather";

const BATCH_SIZE  = 10;
const BATCH_DELAY = 1000; // ms between batches

export async function POST(req: NextRequest) {
  const dryRun = req.nextUrl.searchParams.get("dryRun") === "1";

  const activities = await prisma.activity.findMany({
    where: {
      activityType: { in: ["running", "trail_running"] },
      OR: [
        { temperatureC: null },
        { humidityPct: null },
      ],
    },
    orderBy: { date: "desc" },
    select:  { id: true, date: true, startLat: true, startLon: true },
  });

  console.log(`[backfill] ${activities.length} synced runs need weather data`);

  let processed = 0;
  let failed    = 0;
  let skipped   = 0;

  if (dryRun) {
    return NextResponse.json({
      dryRun: true,
      candidates: activities.length,
      processed,
      failed,
      skipped,
    });
  }

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
          console.log(`[backfill] ${act.id}  ${weather.temperatureC}C  ${weather.humidityPct}%`);
          processed++;
        } else {
          console.warn(`[backfill] ${act.id}  no data`);
          failed++;
        }
      })
    );

    const remaining = activities.length - i - BATCH_SIZE;
    if (remaining > 0) {
      console.log(`[backfill] batch done - ${remaining} remaining, waiting ${BATCH_DELAY}ms`);
      await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY));
    }
  }

  console.log(`[backfill] complete - processed: ${processed}, failed: ${failed}, skipped: ${skipped}`);
  return NextResponse.json({ processed, failed, skipped });
}

export async function GET(req: NextRequest) {
  const dryRunUrl = new URL(req.url);
  dryRunUrl.searchParams.set("dryRun", "1");
  return POST(new NextRequest(dryRunUrl));
}
