import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { GENERATED_PLAN_ID, loadGeneratedPlan } from "@/lib/planStorage";
import { computeWeekInsight, plannedWeekKm, sessionDisplayType } from "@/lib/noviceAnalytics";

export const dynamic = "force-dynamic";

const DAY_LABEL: Record<string, string> = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
  sun: "Sunday",
};

export async function GET(
  req: Request,
  { params }: { params: Promise<{ weekNumber: string }> },
) {
  void req;
  try {
    const p = await params;
    const weekNumber = Number(p.weekNumber);
    if (!Number.isFinite(weekNumber) || weekNumber < 1) {
      return NextResponse.json({ error: "invalid_week" }, { status: 400 });
    }

    const stored = await loadGeneratedPlan();
    if (!stored?.plan.length || stored.config.level !== "NOVICE") {
      return NextResponse.json({ error: "no_novice_plan" }, { status: 404 });
    }

    const week = stored.plan.find((w) => w.week === weekNumber);
    if (!week) return NextResponse.json({ error: "week_not_found" }, { status: 404 });

    const [checkins, evaluation, mutation] = await Promise.all([
      prisma.noviceSessionCheckin.findMany({
        where: { planId: GENERATED_PLAN_ID, weekNumber },
        orderBy: { createdAt: "asc" },
      }),
      prisma.noviceWeeklyEvaluation.findFirst({
        where: { planId: GENERATED_PLAN_ID, weekNumber },
        orderBy: { evaluatedAt: "desc" },
      }),
      prisma.novicePlanMutation.findFirst({
        where: { planId: GENERATED_PLAN_ID, weekNumber },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    const plannedKm = Number(plannedWeekKm(week).toFixed(1));
    const actualBySession = new Map(checkins.map((c) => [c.sessionId, c] as const));

    let actualFromData = 0;
    let completedCount = 0;
    let rpeSum = 0;
    let rpeCount = 0;
    let hasInjury = false;

    const sessions = week.sessions.map((s) => {
      const c = actualBySession.get(s.id);
      const actualKm = c?.actualDistanceKm ?? null;
      if (actualKm != null) {
        actualFromData += actualKm;
      }
      if (c?.completed) {
        completedCount += 1;
        if (actualKm == null) actualFromData += c.plannedDistanceKm;
      }
      if (c && c.userRpe > 0) {
        rpeSum += c.userRpe;
        rpeCount += 1;
      }
      if (c?.skippedReason === "injury") hasInjury = true;

      return {
        day: DAY_LABEL[s.day] ?? s.day,
        sessionType: sessionDisplayType(s.type),
        plannedKm: s.targetDistanceKm,
        actualKm,
        userRpe: c?.userRpe ?? null,
        completed: c?.completed ?? false,
        skippedReason: c?.skippedReason ?? null,
      };
    });

    const sessionsPlanned = week.sessions.length;
    const sessionsCompleted = evaluation?.totalSessionsCompleted ?? completedCount;
    const completionRate =
      evaluation?.completionRate ?? Number((sessionsCompleted / Math.max(1, sessionsPlanned)).toFixed(2));
    const actualKm = evaluation?.totalActualKm ?? (checkins.length ? Number(actualFromData.toFixed(1)) : null);
    const averageRpe = evaluation?.averageUserRpe ?? (rpeCount ? Number((rpeSum / rpeCount).toFixed(1)) : null);

    const weekInsight = computeWeekInsight({
      completionRate,
      averageRpe,
      sessionsCompleted,
      sessionsPlanned,
      hasInjuryFlag: evaluation?.hasInjuryFlag ?? hasInjury,
      hasAnyData: checkins.length > 0,
    });

    return NextResponse.json({
      weekNumber,
      phase: week.phase,
      plannedKm,
      actualKm,
      completionRate,
      averageRpe,
      adaptiveMutation: mutation
        ? {
            mutationType: mutation.mutationType,
            decisionReason: evaluation?.decisionReason ?? "Plan adjusted for this week.",
          }
        : null,
      sessions,
      weekInsight,
    });
  } catch (error) {
    console.error("[novice/analytics/week]", error);
    return NextResponse.json({ error: "analytics_week_failed" }, { status: 500 });
  }
}
