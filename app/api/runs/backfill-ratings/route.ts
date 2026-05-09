import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getDynamicLongRunThresholdKm } from "@/lib/longRunThreshold";
import { persistActivityRating } from "@/lib/persistActivityRating";
import { recalculatePlayerRating } from "@/lib/playerRating";
import { dbSettingsToUserSettings, DEFAULT_SETTINGS } from "@/lib/settings";

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

  const playerRating = await recalculatePlayerRating(prisma);

  return NextResponse.json({ updated: ok, errors, total: ids.length, playerRating });
}
