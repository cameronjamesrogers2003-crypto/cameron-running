import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { GENERATED_PLAN_ID, loadGeneratedPlan } from "@/lib/planStorage";
import {
  computeCurrentAndBestStreak,
  computeLongestRunKm,
  getRunWalkForWeek,
  isCutbackWeek,
  plannedWeekKm,
  summarizeWeeklyActualKm,
} from "@/lib/noviceAnalytics";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const stored = await loadGeneratedPlan();
    if (!stored?.plan.length || stored.config.level !== "NOVICE") {
      return NextResponse.json({ error: "no_novice_plan" }, { status: 404 });
    }

    const [checkins, evaluations, mutations] = await Promise.all([
      prisma.noviceSessionCheckin.findMany({
        where: { planId: GENERATED_PLAN_ID },
        orderBy: { createdAt: "asc" },
      }),
      prisma.noviceWeeklyEvaluation.findMany({
        where: { planId: GENERATED_PLAN_ID },
        orderBy: { weekNumber: "asc" },
      }),
      prisma.novicePlanMutation.findMany({
        where: { planId: GENERATED_PLAN_ID },
        orderBy: { createdAt: "asc" },
      }),
    ]);

    const checkinsByWeek = new Map<number, typeof checkins>();
    for (const c of checkins) {
      const arr = checkinsByWeek.get(c.weekNumber) ?? [];
      arr.push(c);
      checkinsByWeek.set(c.weekNumber, arr);
    }

    const evalByWeek = new Map<number, (typeof evaluations)[number]>();
    for (const e of evaluations) evalByWeek.set(e.weekNumber, e);

    const repeatWeeks = new Set<number>();
    for (const m of mutations) {
      if (m.mutationType === "REPEAT_WEEK") repeatWeeks.add(m.weekNumber);
    }

    const weeklyVolumes = stored.plan.map((w) => {
      const plannedKm = Number(plannedWeekKm(w).toFixed(1));
      const weekCheckins = checkinsByWeek.get(w.week) ?? [];
      const agg = summarizeWeeklyActualKm(w, weekCheckins.map((c) => ({
        sessionId: c.sessionId,
        weekNumber: c.weekNumber,
        sessionType: c.sessionType,
        plannedDistanceKm: c.plannedDistanceKm,
        actualDistanceKm: c.actualDistanceKm,
        completed: c.completed,
        userRpe: c.userRpe,
        skippedReason: c.skippedReason,
        effortScore: c.effortScore,
        createdAt: c.createdAt,
      })));
      const actualKm = agg.actualKm;
      const completionRate = actualKm == null || plannedKm <= 0 ? 0 : Number((actualKm / plannedKm).toFixed(2));
      const adaptiveDecision = evalByWeek.get(w.week)?.adaptiveDecision ?? null;
      return {
        weekNumber: w.week,
        plannedKm,
        actualKm,
        completionRate,
        adaptiveDecision,
        isCutback: isCutbackWeek(w),
        isRepeat: repeatWeeks.has(w.week),
        hasStravaData: agg.hasStrava,
      };
    });

    const totalSessionsCompleted = checkins.filter((c) => c.completed).length;
    const totalSessionsPlanned = stored.plan.reduce((sum, w) => sum + w.sessions.length, 0);
    const totalPlannedKm = Number(stored.plan.reduce((sum, w) => sum + plannedWeekKm(w), 0).toFixed(1));

    const stravaRows = checkins.filter((c) => c.actualDistanceKm != null);
    const totalActualKm = stravaRows.length
      ? Number(stravaRows.reduce((sum, c) => sum + (c.actualDistanceKm ?? 0), 0).toFixed(1))
      : null;

    const streak = computeCurrentAndBestStreak(
      checkins.map((c) => ({
        sessionId: c.sessionId,
        weekNumber: c.weekNumber,
        sessionType: c.sessionType,
        plannedDistanceKm: c.plannedDistanceKm,
        actualDistanceKm: c.actualDistanceKm,
        completed: c.completed,
        userRpe: c.userRpe,
        skippedReason: c.skippedReason,
        effortScore: c.effortScore,
        createdAt: c.createdAt,
      })),
    );

    const completedWeeks = new Set(
      evaluations.filter((e) => e.totalSessionsCompleted > 0).map((e) => e.weekNumber),
    );

    const longestRunKm = computeLongestRunKm(
      stored.config.goal,
      checkins.map((c) => ({
        sessionId: c.sessionId,
        weekNumber: c.weekNumber,
        sessionType: c.sessionType,
        plannedDistanceKm: c.plannedDistanceKm,
        actualDistanceKm: c.actualDistanceKm,
        completed: c.completed,
        userRpe: c.userRpe,
        skippedReason: c.skippedReason,
        effortScore: c.effortScore,
        createdAt: c.createdAt,
      })),
      stored.plan,
      completedWeeks,
    );

    let sessionNumber = 0;
    const byCreated = checkins.slice().sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    const sessionRpeHistory = byCreated
      .filter((c) => c.completed || c.userRpe > 0)
      .map((c) => {
        sessionNumber += 1;
        return {
          sessionNumber,
          weekNumber: c.weekNumber,
          sessionType: c.sessionType,
          userRpe: c.userRpe ?? null,
          effortScore: c.effortScore,
        };
      });

    const runWalkProgression = stored.plan.map((w) => {
      const rw = getRunWalkForWeek(w);
      return {
        weekNumber: w.week,
        runSec: rw.runSec,
        walkSec: rw.walkSec,
        isContinuous: rw.isContinuous,
      };
    });

    return NextResponse.json({
      totalSessionsCompleted,
      totalSessionsPlanned,
      totalActualKm,
      totalPlannedKm,
      currentStreak: streak.currentStreak,
      bestStreak: streak.bestStreak,
      longestRunKm,
      weeklyVolumes,
      sessionRpeHistory,
      runWalkProgression,
    });
  } catch (error) {
    console.error("[novice/analytics/summary]", error);
    return NextResponse.json({ error: "analytics_summary_failed" }, { status: 500 });
  }
}
