import { redirect } from "next/navigation";
import { loadGeneratedPlan } from "@/lib/planStorage";
import { defaultNoviceRuntimeState } from "@/types/generatedPlan";
import { NoviceInjuryPauseClient } from "@/components/novice/NoviceInjuryPauseClient";
import { dbSettingsToUserSettings, DEFAULT_SETTINGS } from "@/lib/settings";
import { getEffectivePlanStart, getPlanWeekForDate, parsePlanFirstSessionDay } from "@/lib/planUtils";
import prisma from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata = { title: "Runshift — Plan paused" };

export default async function NovicePausedPage() {
  const stored = await loadGeneratedPlan();
  const rt = stored?.noviceRuntime ?? defaultNoviceRuntimeState();
  if (rt.planStatus !== "PAUSED_INJURY") redirect("/plan/novice");

  const settingsRow = await prisma.userSettings.findUnique({ where: { id: 1 } });
  const settings = settingsRow ? dbSettingsToUserSettings(settingsRow) : DEFAULT_SETTINGS;
  const planStart = getEffectivePlanStart(settings.planStartDate, parsePlanFirstSessionDay(settings.trainingDays));
  const rawWeek = getPlanWeekForDate(new Date(), planStart);
  const lastW = stored?.plan?.length ? stored.plan[stored.plan.length - 1]!.week : 1;
  const currentWeek = rawWeek > 0 && stored?.plan?.length ? Math.min(lastW, rawWeek) : 1;

  return <NoviceInjuryPauseClient currentWeek={currentWeek} />;
}
