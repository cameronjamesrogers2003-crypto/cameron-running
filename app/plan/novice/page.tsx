import { redirect } from "next/navigation";
import prisma from "@/lib/db";
import { loadGeneratedPlan, GENERATED_PLAN_ID } from "@/lib/planStorage";
import { defaultNoviceRuntimeState } from "@/types/generatedPlan";
import { dbSettingsToUserSettings, DEFAULT_SETTINGS } from "@/lib/settings";
import { getEffectivePlanStart, getPlanWeekForDate, parsePlanFirstSessionDay } from "@/lib/planUtils";
import { NovicePlanPageClient, type SerializedCheckin, type SerializedEval } from "@/components/novice/NovicePlanPageClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Runshift — Your program" };

export default async function NovicePlanPage() {
  const stored = await loadGeneratedPlan();
  if (!stored?.plan.length) {
    return (
      <div className="max-w-[680px] mx-auto px-4 py-16 text-center space-y-4">
        <p className="text-[#475569]">Your Novice program hasn&apos;t been set up yet.</p>
        <a href="/onboarding" className="inline-block rounded-xl bg-[#2d6a4f] px-5 py-3 text-white font-semibold">
          Choose your program
        </a>
      </div>
    );
  }
  if (stored.config.level !== "NOVICE") redirect("/program");

  const rt = stored.noviceRuntime ?? defaultNoviceRuntimeState();
  if (rt.planStatus === "PAUSED_INJURY") redirect("/plan/novice/paused");
  if (rt.planStatus === "GRADUATED") redirect("/plan/novice/graduation");

  const [checkins, evaluations, mutations, settingsRow] = await Promise.all([
    prisma.noviceSessionCheckin.findMany({
      where: { planId: GENERATED_PLAN_ID },
      orderBy: { createdAt: "asc" },
    }),
    prisma.noviceWeeklyEvaluation.findMany({
      where: { planId: GENERATED_PLAN_ID },
      orderBy: { evaluatedAt: "desc" },
    }),
    prisma.novicePlanMutation.findMany({
      where: { planId: GENERATED_PLAN_ID },
      orderBy: { createdAt: "asc" },
    }),
    prisma.userSettings.findUnique({ where: { id: 1 } }),
  ]);

  const checkinsByWeek: Record<number, SerializedCheckin[]> = {};
  for (const c of checkins) {
    const row: SerializedCheckin = {
      sessionId: c.sessionId,
      weekNumber: c.weekNumber,
      completed: c.completed,
      userRpe: c.userRpe,
      skippedReason: c.skippedReason,
      actualDistanceKm: c.actualDistanceKm,
      distanceCompletionRatio: c.distanceCompletionRatio,
    };
    if (!checkinsByWeek[c.weekNumber]) checkinsByWeek[c.weekNumber] = [];
    checkinsByWeek[c.weekNumber].push(row);
  }

  const weekMeta: Record<number, { repeated?: boolean; reduced?: boolean }> = {};
  for (const m of mutations) {
    if (m.mutationType === "REPEAT_WEEK") {
      weekMeta[m.weekNumber] = { ...weekMeta[m.weekNumber], repeated: true };
    }
    if (m.mutationType === "REDUCE_LOAD") {
      weekMeta[m.weekNumber] = { ...weekMeta[m.weekNumber], reduced: true };
    }
  }

  const settings = settingsRow ? dbSettingsToUserSettings(settingsRow) : DEFAULT_SETTINGS;
  const planStart = getEffectivePlanStart(settings.planStartDate, parsePlanFirstSessionDay(settings.trainingDays));
  const rawWeek = getPlanWeekForDate(new Date(), planStart);
  const lastW = stored.plan[stored.plan.length - 1]?.week ?? 1;
  const currentWeek = rawWeek > 0 ? Math.min(lastW, rawWeek) : 1;

  const goalBadge: "5K Program" | "10K Program" = stored.config.goal === "10k" ? "10K Program" : "5K Program";

  const evalSerialized: SerializedEval[] = evaluations.map((e) => ({
    id: e.id,
    weekNumber: e.weekNumber,
    adaptiveDecision: e.adaptiveDecision,
    decisionReason: e.decisionReason,
    evaluatedAt: e.evaluatedAt.toISOString(),
  }));

  return (
    <NovicePlanPageClient
      plan={stored.plan}
      config={stored.config}
      checkinsByWeek={checkinsByWeek}
      evaluations={evalSerialized}
      weekMeta={weekMeta}
      currentWeek={currentWeek}
      goalBadge={goalBadge}
    />
  );
}
