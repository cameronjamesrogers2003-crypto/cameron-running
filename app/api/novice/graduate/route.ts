import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { evaluateNoviceGraduation } from "@/lib/noviceGraduation";
import { GENERATED_PLAN_ID, loadGeneratedPlan, saveGeneratedPlan } from "@/lib/planStorage";
import { defaultNoviceRuntimeState } from "@/types/generatedPlan";
import type { NoviceWeeklyEvaluation } from "@/types/novice";

const USER_ID = "1";

export async function POST() {
  try {
    const stored = await loadGeneratedPlan();
    if (!stored?.plan.length || stored.config.level !== "NOVICE") {
      return NextResponse.json({ eligible: false, handoffData: null, reason: "no_novice_plan" });
    }

    const lastWeek = stored.plan[stored.plan.length - 1];
    const finalEvalRow = await prisma.noviceWeeklyEvaluation.findFirst({
      where: { planId: GENERATED_PLAN_ID, weekNumber: lastWeek.week },
      orderBy: { evaluatedAt: "desc" },
    });

    const finalWeekEvaluation: Pick<
      NoviceWeeklyEvaluation,
      "weekNumber" | "completionRate" | "hasInjuryFlag"
    > | null = finalEvalRow
      ? {
          weekNumber: finalEvalRow.weekNumber,
          completionRate: finalEvalRow.completionRate,
          hasInjuryFlag: finalEvalRow.hasInjuryFlag,
        }
      : null;

    const allEvals = await prisma.noviceWeeklyEvaluation.findMany({
      where: { planId: GENERATED_PLAN_ID },
    });
    const totalSessionsCompleted = allEvals.reduce((a, e) => a + e.totalSessionsCompleted, 0);
    const totalKmCovered = allEvals.reduce(
      (a, e) => a + (e.totalActualKm ?? e.totalPlannedKm * e.completionRate),
      0,
    );
    const peakWeeklyKm = allEvals.reduce(
      (a, e) => Math.max(a, e.totalActualKm ?? e.totalPlannedKm * e.completionRate),
      0,
    );
    const rpeVals = allEvals.filter((e) => e.averageUserRpe > 0).map((e) => e.averageUserRpe);
    const averageWeeklyRpe =
      rpeVals.length > 0 ? rpeVals.reduce((a, b) => a + b, 0) / rpeVals.length : 0;

    const lastN = Math.min(4, stored.plan.length);
    const tailWeekNums = stored.plan.slice(-lastN).map((w) => w.week);

    let bestLongRunKmLastFourWeeks = 0;
    let bestPace: number | null = null;

    const longSessions = await prisma.noviceSessionCheckin.findMany({
      where: {
        planId: GENERATED_PLAN_ID,
        sessionType: "long",
        completed: true,
        weekNumber: { in: tailWeekNums },
      },
    });
    for (const c of longSessions) {
      const km = c.actualDistanceKm ?? c.plannedDistanceKm;
      if (km > bestLongRunKmLastFourWeeks) bestLongRunKmLastFourWeeks = km;
      if (c.averagePaceSecPerKm != null) {
        if (bestPace == null || c.averagePaceSecPerKm < bestPace) bestPace = c.averagePaceSecPerKm;
      }
    }

    if (bestLongRunKmLastFourWeeks === 0) {
      for (const w of stored.plan) {
        if (!tailWeekNums.includes(w.week)) continue;
        for (const s of w.sessions) {
          if (s.type === "long") {
            bestLongRunKmLastFourWeeks = Math.max(bestLongRunKmLastFourWeeks, s.targetDistanceKm);
          }
        }
      }
    }

    const rt = stored.noviceRuntime ?? defaultNoviceRuntimeState();
    const result = evaluateNoviceGraduation({
      userId: USER_ID,
      config: stored.config,
      planWeeks: stored.plan,
      planStatus: rt.planStatus,
      finalWeekEvaluation,
      bestLongRunKmLastFourWeeks,
      totalSessionsCompleted,
      totalKmCovered,
      peakWeeklyKm,
      averageWeeklyRpe,
      estimatedPaceSecPerKm: bestPace,
    });

    if (result.eligible && result.handoffData) {
      const h = result.handoffData;
      await prisma.noviceHandoffData.upsert({
        where: { userId: USER_ID },
        create: {
          userId: USER_ID,
          planId: GENERATED_PLAN_ID,
          completedGoal: h.completedGoal,
          programWeeks: h.programWeeks,
          totalSessionsCompleted: h.totalSessionsCompleted,
          totalKmCovered: h.totalKmCovered,
          estimatedPaceSecPerKm: h.estimatedPaceSecPerKm,
          peakWeeklyKm: h.peakWeeklyKm,
          averageWeeklyRpe: h.averageWeeklyRpe,
          suggestedNextLevel: h.suggestedNextLevel,
          suggestedNextGoal: h.suggestedNextGoal,
        },
        update: {
          planId: GENERATED_PLAN_ID,
          completedGoal: h.completedGoal,
          programWeeks: h.programWeeks,
          totalSessionsCompleted: h.totalSessionsCompleted,
          totalKmCovered: h.totalKmCovered,
          estimatedPaceSecPerKm: h.estimatedPaceSecPerKm,
          peakWeeklyKm: h.peakWeeklyKm,
          averageWeeklyRpe: h.averageWeeklyRpe,
          suggestedNextLevel: h.suggestedNextLevel,
          suggestedNextGoal: h.suggestedNextGoal,
        },
      });

      const nextRt = { ...rt, planStatus: "GRADUATED" as const, pausedAt: null };
      await saveGeneratedPlan(stored.config, stored.plan, stored.lockedWeeks, nextRt);
    }

    return NextResponse.json({
      eligible: result.eligible,
      reason: result.reason,
      handoffData: result.handoffData,
    });
  } catch (e) {
    console.error("[novice/graduate]", e);
    return NextResponse.json({ error: "graduate_failed" }, { status: 500 });
  }
}
