import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import {
  applyNoviceAdaptiveDecision,
  buildEvaluationInputFromCheckins,
  evaluateNoviceWeek,
} from "@/lib/noviceAdaptive";
import { finalizePlanDisplayCopy } from "@/lib/generatePlan";
import { GENERATED_PLAN_ID, loadGeneratedPlan, saveGeneratedPlan } from "@/lib/planStorage";
import type { NoviceSessionCheckin } from "@/types/novice";
import type { NoviceSessionCheckin as PrismaCheckinRow } from "@prisma/client";

function rowToCheckin(row: PrismaCheckinRow): NoviceSessionCheckin {
  return {
    sessionId: row.sessionId,
    weekNumber: row.weekNumber,
    sessionType: row.sessionType as NoviceSessionCheckin["sessionType"],
    plannedDistanceKm: row.plannedDistanceKm,
    plannedDurationMin: row.plannedDurationMin,
    stravaActivityId: row.stravaActivityId,
    actualDistanceKm: row.actualDistanceKm,
    actualDurationMin: row.actualDurationMin,
    averagePaceSecPerKm: row.averagePaceSecPerKm,
    averageHeartRate: row.averageHeartRate,
    maxHeartRate: row.maxHeartRate,
    perceivedEffortFromHr: row.perceivedEffortFromHr,
    completed: row.completed,
    userRpe: row.userRpe,
    skippedReason: row.skippedReason as NoviceSessionCheckin["skippedReason"],
    distanceCompletionRatio: row.distanceCompletionRatio,
    effortScore: row.effortScore,
    createdAt: row.createdAt.toISOString(),
  };
}

const USER_ID = "1";

export async function POST(req: NextRequest) {
  try {
    let weekNumber: number;
    try {
      const body = (await req.json()) as { weekNumber?: unknown };
      weekNumber =
        typeof body.weekNumber === "number" ? body.weekNumber : Number(body.weekNumber);
    } catch {
      return NextResponse.json({ error: "bad_request" }, { status: 400 });
    }

    if (!Number.isFinite(weekNumber) || weekNumber < 1) {
      return NextResponse.json({ error: "invalid_week" }, { status: 400 });
    }

    const stored = await loadGeneratedPlan();
    if (!stored?.plan.length) {
      return NextResponse.json({ error: "no_plan" }, { status: 404 });
    }
    if (stored.config.level !== "NOVICE") {
      return NextResponse.json({ error: "not_novice_plan" }, { status: 400 });
    }
    const rt = stored.noviceRuntime;
    if (rt?.planStatus === "PAUSED_INJURY") {
      return NextResponse.json({ error: "plan_paused" }, { status: 409 });
    }

    const planWeek = stored.plan.find((w) => w.week === weekNumber);
    if (!planWeek) {
      return NextResponse.json({ error: "week_not_found" }, { status: 404 });
    }

    const rows = await prisma.noviceSessionCheckin.findMany({
      where: { planId: GENERATED_PLAN_ID, weekNumber },
      orderBy: { createdAt: "asc" },
    });
    const checkins = rows.map(rowToCheckin);

    const evalInput = buildEvaluationInputFromCheckins({
      userId: USER_ID,
      planId: GENERATED_PLAN_ID,
      weekNumber,
      checkins,
      planWeek,
    });

    const { decision, reason } = evaluateNoviceWeek(evalInput, stored.config, weekNumber, {
      noviceRuntime: rt,
    });

    const evaluation = await prisma.noviceWeeklyEvaluation.create({
      data: {
        userId: USER_ID,
        planId: GENERATED_PLAN_ID,
        weekNumber: evalInput.weekNumber,
        totalSessionsPlanned: evalInput.totalSessionsPlanned,
        totalSessionsCompleted: evalInput.totalSessionsCompleted,
        completionRate: evalInput.completionRate,
        totalPlannedKm: evalInput.totalPlannedKm,
        totalActualKm: evalInput.totalActualKm,
        volumeCompletionRatio: evalInput.volumeCompletionRatio,
        averageUserRpe: evalInput.averageUserRpe,
        averageEffortScore: evalInput.averageEffortScore,
        sessionsMissed: evalInput.sessionsMissed,
        missedReasons: evalInput.missedReasons.flatMap((r) => (r ? [r] : [])),
        hasInjuryFlag: evalInput.hasInjuryFlag,
        hasIllnessFlag: evalInput.hasIllnessFlag,
        adaptiveDecision: decision,
        decisionReason: reason,
      },
    });

    const bundle = {
      weeks: stored.plan.map((w) => ({
        ...w,
        sessions: w.sessions.map((s) => ({ ...s })),
      })),
      noviceRuntime: rt,
    };

    const { bundle: nextBundle, mutations } = applyNoviceAdaptiveDecision(
      bundle,
      decision,
      weekNumber,
      stored.config,
      evaluation.id,
      GENERATED_PLAN_ID,
    );

    finalizePlanDisplayCopy(nextBundle.weeks, "NOVICE");

    await saveGeneratedPlan(
      stored.config,
      nextBundle,
      stored.lockedWeeks,
      nextBundle.noviceRuntime,
    );

    if (mutations.length > 0) {
      await prisma.novicePlanMutation.createMany({
        data: mutations.map((m) => ({
          planId: GENERATED_PLAN_ID,
          triggeredByEvaluation: m.triggeredByEvaluation,
          weekNumber: m.weekNumber,
          mutationType: m.mutationType,
          originalWeekData: m.originalWeekData as object,
          mutatedWeekData: m.mutatedWeekData as object,
        })),
      });
    }

    return NextResponse.json({
      decision,
      reason,
      evaluationId: evaluation.id,
      plan: nextBundle.weeks,
      noviceRuntime: nextBundle.noviceRuntime,
    });
  } catch (e) {
    console.error("[novice/evaluate]", e);
    return NextResponse.json({ error: "evaluate_failed" }, { status: 500 });
  }
}
