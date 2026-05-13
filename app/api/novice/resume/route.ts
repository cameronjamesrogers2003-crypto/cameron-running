import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { GENERATED_PLAN_ID, loadGeneratedPlan, saveGeneratedPlan } from "@/lib/planStorage";
import { defaultNoviceRuntimeState } from "@/types/generatedPlan";

export async function POST(req: NextRequest) {
  try {
    let weekNumber = 1;
    try {
      const body = (await req.json()) as { weekNumber?: unknown };
      if (body.weekNumber != null) {
        weekNumber =
          typeof body.weekNumber === "number" ? body.weekNumber : Number(body.weekNumber);
      }
    } catch {
      void 0;
    }

    if (!Number.isFinite(weekNumber) || weekNumber < 1) {
      return NextResponse.json({ error: "invalid_week" }, { status: 400 });
    }

    const stored = await loadGeneratedPlan();
    if (!stored?.plan.length || stored.config.level !== "NOVICE") {
      return NextResponse.json({ error: "no_novice_plan" }, { status: 404 });
    }

    const rt = stored.noviceRuntime ?? defaultNoviceRuntimeState();
    if (rt.planStatus !== "PAUSED_INJURY") {
      return NextResponse.json({ error: "not_paused" }, { status: 400 });
    }

    const nextRt = {
      ...rt,
      planStatus: "ACTIVE" as const,
      pausedAt: null,
    };

    await prisma.noviceSessionCheckin.deleteMany({
      where: { planId: GENERATED_PLAN_ID, weekNumber },
    });

    await saveGeneratedPlan(stored.config, stored.plan, stored.lockedWeeks, nextRt);

    return NextResponse.json({
      planStatus: nextRt.planStatus,
      plan: stored.plan,
      noviceRuntime: nextRt,
    });
  } catch (e) {
    console.error("[novice/resume]", e);
    return NextResponse.json({ error: "resume_failed" }, { status: 500 });
  }
}
