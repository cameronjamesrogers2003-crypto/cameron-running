import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { loadGeneratedPlan } from "@/lib/planStorage";
import { resolveRunSession } from "@/lib/rating";
import { getEffectivePlanStart, parsePlanFirstSessionDay } from "@/lib/planUtils";
import { dbSettingsToUserSettings, DEFAULT_SETTINGS } from "@/lib/settings";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const activity = await prisma.activity.findUnique({
      where: { id },
    });

    if (!activity) {
      return NextResponse.json({ error: "Activity not found" }, { status: 404 });
    }

    const [settingsRow, generatedPlan] = await Promise.all([
      prisma.userSettings.findUnique({ where: { id: 1 } }),
      loadGeneratedPlan(),
    ]);

    const settings = settingsRow ? dbSettingsToUserSettings(settingsRow) : DEFAULT_SETTINGS;
    const planStart = getEffectivePlanStart(settings.planStartDate, parsePlanFirstSessionDay(settings.trainingDays));

    const plannedSession = generatedPlan
      ? resolveRunSession(
          {
            id: activity.id,
            date: new Date(activity.date), // activity.date from Prisma is UTC
            distanceKm: activity.distanceKm,
            avgPaceSecKm: activity.avgPaceSecKm,
          },
          generatedPlan.plan,
          planStart
        )
      : null;

    return NextResponse.json({
      activity,
      plannedSession,
    });
  } catch (error) {
    console.error("[confirm-context] failed:", error);
    return NextResponse.json({ error: "Failed to fetch context" }, { status: 500 });
  }
}
