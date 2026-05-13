import { redirect } from "next/navigation";
import prisma from "@/lib/db";
import { GENERATED_PLAN_ID, loadGeneratedPlan } from "@/lib/planStorage";
import { dbSettingsToUserSettings, DEFAULT_SETTINGS } from "@/lib/settings";
import { getEffectivePlanStart, getPlanWeekForDate, parsePlanFirstSessionDay } from "@/lib/planUtils";
import NoviceProgressPageClient from "@/components/novice/analytics/NoviceProgressPageClient";
import {
  computeCurrentAndBestStreak,
  computeLongestRunKm,
  computeWeekInsight,
  getRunWalkForWeek,
  isCutbackWeek,
  plannedWeekKm,
  sessionDisplayType,
  summarizeWeeklyActualKm,
  goalDistanceKm,
} from "@/lib/noviceAnalytics";

export const dynamic = "force-dynamic";
export const metadata = { title: "Runshift — Novice progress" };

const DAY_LABEL: Record<string, string> = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
  sun: "Sunday",
};

export default async function NoviceProgressPage() {
  const stored = await loadGeneratedPlan();
  if (!stored?.plan.length) redirect("/onboarding");
  if (stored.config.level !== "NOVICE") redirect("/program");

  const [checkins, evaluations, mutations, settingsRow] = await Promise.all([
    prisma.noviceSessionCheckin.findMany({ where: { planId: GENERATED_PLAN_ID }, orderBy: { createdAt: "asc" } }),
    prisma.noviceWeeklyEvaluation.findMany({ where: { planId: GENERATED_PLAN_ID }, orderBy: { weekNumber: "asc" } }),
    prisma.novicePlanMutation.findMany({ where: { planId: GENERATED_PLAN_ID }, orderBy: { createdAt: "asc" } }),
    prisma.userSettings.findUnique({ where: { id: 1 } }),
  ]);

  const settings = settingsRow ? dbSettingsToUserSettings(settingsRow) : DEFAULT_SETTINGS;
  const planStart = getEffectivePlanStart(settings.planStartDate, parsePlanFirstSessionDay(settings.trainingDays));
  const rawWeek = getPlanWeekForDate(new Date(), planStart);
  const lastWeek = stored.plan[stored.plan.length - 1]?.week ?? 1;
  const currentWeek = rawWeek > 0 ? Math.min(lastWeek, rawWeek) : 1;

  const evalByWeek = new Map(evaluations.map((e) => [e.weekNumber, e] as const));
  const mutByWeek = new Map<number, (typeof mutations)[number]>();
  for (const m of mutations) mutByWeek.set(m.weekNumber, m);

  const checkinsByWeek = new Map<number, typeof checkins>();
  for (const c of checkins) {
    const arr = checkinsByWeek.get(c.weekNumber) ?? [];
    arr.push(c);
    checkinsByWeek.set(c.weekNumber, arr);
  }

  const weeklyVolumes = stored.plan.map((w) => {
    const wk = checkinsByWeek.get(w.week) ?? [];
    const agg = summarizeWeeklyActualKm(
      w,
      wk.map((c) => ({
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
    const plannedKm = Number(plannedWeekKm(w).toFixed(1));
    const actualKm = agg.actualKm;
    const completionRate = actualKm == null ? 0 : Number((actualKm / Math.max(1, plannedKm)).toFixed(2));
    const mutation = mutByWeek.get(w.week);
    return {
      weekNumber: w.week,
      plannedKm,
      actualKm,
      completionRate,
      adaptiveDecision: evalByWeek.get(w.week)?.adaptiveDecision ?? null,
      isCutback: isCutbackWeek(w),
      isRepeat: mutation?.mutationType === "REPEAT_WEEK",
      hasStravaData: agg.hasStrava,
    };
  });

  const sessionRpeSource = checkins.filter((c) => c.completed || c.userRpe > 0);
  const sessionRpeHistory = sessionRpeSource.map((c, idx) => {
      return {
        sessionNumber: idx + 1,
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

  const completedWeeks = new Set(evaluations.filter((e) => e.totalSessionsCompleted > 0).map((e) => e.weekNumber));
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

  const weekDetails = Object.fromEntries(
    stored.plan.map((w) => {
      const wkCheckins = checkinsByWeek.get(w.week) ?? [];
      const bySession = new Map(wkCheckins.map((c) => [c.sessionId, c] as const));
      const sessions = w.sessions.map((s) => {
        const c = bySession.get(s.id);
        return {
          day: DAY_LABEL[s.day] ?? s.day,
          sessionType: sessionDisplayType(s.type),
          plannedKm: s.targetDistanceKm,
          actualKm: c?.actualDistanceKm ?? null,
          userRpe: c?.userRpe ?? null,
          completed: c?.completed ?? false,
          skippedReason: c?.skippedReason ?? null,
        };
      });

      const plannedKm = Number(plannedWeekKm(w).toFixed(1));
      const evalRow = evalByWeek.get(w.week);
      const completed = evalRow?.totalSessionsCompleted ?? sessions.filter((s) => s.completed).length;
      const completionRate = evalRow?.completionRate ?? Number((completed / Math.max(1, sessions.length)).toFixed(2));
      const averageRpe = evalRow?.averageUserRpe ?? null;
      const actualKm = evalRow?.totalActualKm ?? null;
      const mutation = mutByWeek.get(w.week);

      const insight = computeWeekInsight({
        completionRate,
        averageRpe,
        sessionsCompleted: completed,
        sessionsPlanned: sessions.length,
        hasInjuryFlag: evalRow?.hasInjuryFlag ?? wkCheckins.some((c) => c.skippedReason === "injury"),
        hasAnyData: wkCheckins.length > 0,
      });

      return [
        w.week,
        {
          weekNumber: w.week,
          phase: w.phase,
          plannedKm,
          actualKm,
          completionRate,
          averageRpe,
          adaptiveMutation: mutation
            ? {
                mutationType: mutation.mutationType,
                decisionReason: evalRow?.decisionReason ?? "Plan adjusted this week.",
              }
            : null,
          sessions,
          weekInsight: insight,
        },
      ];
    }),
  );

  const summary = {
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
  };

  const goalBadge = stored.config.goal === "10k" ? "10K Program" : "5K Program";
  const goalKm = goalDistanceKm(stored.config.goal);

  return (
    <NoviceProgressPageClient
      goalBadge={goalBadge}
      currentWeek={currentWeek}
      totalWeeks={stored.plan.length}
      weeksRemaining={Math.max(0, stored.plan.length - currentWeek)}
      summary={summary}
      weekDetails={weekDetails}
      goalDistanceKm={goalKm}
    />
  );
}
