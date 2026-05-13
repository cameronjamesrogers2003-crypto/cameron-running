import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { loadGeneratedPlan, saveGeneratedPlan } from "@/lib/planStorage";
import { rebuildPaceTargets } from "@/lib/planAdaptation";
import { dbSettingsToUserSettings, DEFAULT_SETTINGS } from "@/lib/settings";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { vdot?: number };
    if (typeof body.vdot !== "number" || !Number.isFinite(body.vdot)) {
      return NextResponse.json({ error: "invalid_vdot" }, { status: 400 });
    }

    const stored = await loadGeneratedPlan();
    if (!stored) {
      return NextResponse.json({ error: "no_plan" }, { status: 404 });
    }

    const row = await prisma.userSettings.findUnique({ where: { id: 1 } });
    const settings = row ? dbSettingsToUserSettings(row) : DEFAULT_SETTINGS;

    const updatedPlan = rebuildPaceTargets(stored.plan, stored.lockedWeeks, settings, body.vdot);
    await saveGeneratedPlan(stored.config, updatedPlan, stored.lockedWeeks, stored.noviceRuntime);
    await prisma.userSettings.update({
      where: { id: 1 },
      data: { currentVdot: Math.round(body.vdot) },
    }).catch(() => {});

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to rebuild paces" }, { status: 500 });
  }
}
