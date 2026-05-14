import { redirect } from "next/navigation";
import { loadGeneratedPlan } from "@/lib/planStorage";
import { defaultNoviceRuntimeState } from "@/types/generatedPlan";

export const dynamic = "force-dynamic";
export const metadata = { title: "Runshift — Your program" };

/** Novice plan UI lives on `/program`; keep this route for bookmarks and redirects. */
export default async function NovicePlanPage() {
  const stored = await loadGeneratedPlan();
  if (!stored?.plan.length) {
    redirect("/program");
  }
  if (stored.config.level !== "NOVICE") {
    redirect("/program");
  }

  const rt = stored.noviceRuntime ?? defaultNoviceRuntimeState();
  if (rt.planStatus === "PAUSED_INJURY") {
    redirect("/plan/novice/paused");
  }
  if (rt.planStatus === "GRADUATED") {
    redirect("/plan/novice/graduation");
  }

  redirect("/program");
}
