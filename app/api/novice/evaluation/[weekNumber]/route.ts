import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { GENERATED_PLAN_ID } from "@/lib/planStorage";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ weekNumber: string }> },
) {
  try {
    const { weekNumber: raw } = await params;
    const weekNumber = Number(raw);
    if (!Number.isFinite(weekNumber) || weekNumber < 1) {
      return NextResponse.json({ error: "invalid_week" }, { status: 400 });
    }

    const row = await prisma.noviceWeeklyEvaluation.findFirst({
      where: { planId: GENERATED_PLAN_ID, weekNumber },
      orderBy: { evaluatedAt: "desc" },
    });
    if (!row) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    return NextResponse.json({
      id: row.id,
      userId: row.userId,
      planId: row.planId,
      weekNumber: row.weekNumber,
      totalSessionsPlanned: row.totalSessionsPlanned,
      totalSessionsCompleted: row.totalSessionsCompleted,
      completionRate: row.completionRate,
      totalPlannedKm: row.totalPlannedKm,
      totalActualKm: row.totalActualKm,
      volumeCompletionRatio: row.volumeCompletionRatio,
      averageUserRpe: row.averageUserRpe,
      averageEffortScore: row.averageEffortScore,
      sessionsMissed: row.sessionsMissed,
      missedReasons: row.missedReasons,
      hasInjuryFlag: row.hasInjuryFlag,
      hasIllnessFlag: row.hasIllnessFlag,
      adaptiveDecision: row.adaptiveDecision,
      decisionReason: row.decisionReason,
      evaluatedAt: row.evaluatedAt.toISOString(),
    });
  } catch (e) {
    console.error("[novice/evaluation]", e);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
