import { redirect } from "next/navigation";
import prisma from "@/lib/db";
import { loadGeneratedPlan, GENERATED_PLAN_ID } from "@/lib/planStorage";
import { defaultNoviceRuntimeState } from "@/types/generatedPlan";
import { NoviceGraduationClient } from "@/components/novice/NoviceGraduationClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Runshift — Program complete" };

export default async function NoviceGraduationPage() {
  const stored = await loadGeneratedPlan();
  const rt = stored?.noviceRuntime ?? defaultNoviceRuntimeState();
  if (rt.planStatus !== "GRADUATED") redirect("/program");

  const handoff = await prisma.noviceHandoffData.findUnique({
    where: { planId: GENERATED_PLAN_ID },
  });

  if (!handoff) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center text-[#475569]">
        <p>We couldn&apos;t load your completion details yet. Try again shortly.</p>
        <a className="mt-4 inline-block underline" href="/program">
          Back to plan
        </a>
      </div>
    );
  }

  return (
    <NoviceGraduationClient
      completedGoal={handoff.completedGoal as "5k" | "10k"}
      programWeeks={handoff.programWeeks}
      totalSessionsCompleted={handoff.totalSessionsCompleted}
      totalKmCovered={handoff.totalKmCovered}
      peakWeeklyKm={handoff.peakWeeklyKm}
      estimatedPaceSecPerKm={handoff.estimatedPaceSecPerKm}
      suggestedNextGoal={handoff.suggestedNextGoal as "5k" | "10k" | "half"}
      suggestedNextLevel={handoff.suggestedNextLevel}
    />
  );
}
