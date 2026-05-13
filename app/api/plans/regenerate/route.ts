// ENGINE: generatePlanV2 (evidence-based spec, May 2026)
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { dbSettingsToUserSettings, DEFAULT_SETTINGS } from "@/lib/settings";
import { generatePlanV2, type PlanConfigV2 } from "@/lib/generatePlanV2";
import { getLockedWeeks, loadGeneratedPlan, saveGeneratedPlan } from "@/lib/planStorage";
import { getEffectivePlanStart, parsePlanFirstSessionDay } from "@/lib/planUtils";
import { defaultNoviceRuntimeState } from "@/types/generatedPlan";
import type { Day, PlanConfig } from "@/data/trainingPlan";

function isDay(x: unknown): x is Day {
  return x === "mon" || x === "tue" || x === "wed" || x === "thu" || x === "fri" || x === "sat" || x === "sun";
}

function parseTrainingDays(raw: string | null): Day[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isDay);
  } catch {
    return [];
  }
}

function goalRaceToV2(goal: string | null | undefined): PlanConfigV2["goalDistance"] {
  if (goal === "5K") return "5K";
  if (goal === "10K") return "10K";
  if (goal === "FULL") return "Marathon";
  return "HalfMarathon";
}

function settingsGoalToPlanGoal(settingsGoal: string | null | undefined): PlanConfig["goal"] {
  if (settingsGoal === "FULL") return "full";
  if (settingsGoal === "10K") return "10k";
  if (settingsGoal === "5K") return "5k";
  return "hm";
}

function levelToV2(level: PlanConfig["level"]): PlanConfigV2["experienceLevel"] {
  if (level === "ELITE") return "ADVANCED";
  return level as PlanConfigV2["experienceLevel"];
}

async function regenerateFromSettings() {
  const settingsRow = await prisma.userSettings.findUnique({ where: { id: 1 } });
  const settings = settingsRow ? dbSettingsToUserSettings(settingsRow) : DEFAULT_SETTINGS;

  const days = parseTrainingDays(settings.trainingDays);
  if (!settings.experienceLevel || days.length < 2) {
    return NextResponse.json(
      { error: "Settings incomplete — complete onboarding first" },
      { status: 400 },
    );
  }

  if (days.length > 6) {
    return NextResponse.json(
      { error: "Settings incomplete — complete onboarding first" },
      { status: 400 },
    );
  }

  const planGoal = settingsGoalToPlanGoal(settings.goalRace);

  const config: PlanConfig = {
    level: settings.experienceLevel,
    goal: planGoal,
    weeks: (settings.planLengthWeeks ?? 16) as 8 | 12 | 16 | 20,
    days,
    longRunDay: isDay(settings.longRunDay) ? settings.longRunDay : undefined,
    vdot: settings.currentVdot ?? 33,
    paceAdjust: {
      easyPaceOffsetSec: settings.easyPaceOffsetSec,
      tempoPaceOffsetSec: settings.tempoPaceOffsetSec,
      intervalPaceOffsetSec: settings.intervalPaceOffsetSec,
      longPaceOffsetSec: settings.longPaceOffsetSec,
      runningExperience: settings.runningExperience,
    },
  };

  const planStart = getEffectivePlanStart(settings.planStartDate, parsePlanFirstSessionDay(settings.trainingDays));

  const planConfigV2: PlanConfigV2 = {
    goalDistance: goalRaceToV2(settings.goalRace),
    experienceLevel: levelToV2(settings.experienceLevel),
    vdot: settings.currentVdot ?? 33,
    totalWeeks: config.weeks,
    sessionsPerWeek: days.length as 2 | 3 | 4 | 5 | 6,
    startDate: planStart,
    trainingDays: days,
    longRunDay: isDay(settings.longRunDay) ? settings.longRunDay : undefined,
  };

  let mergedPlan;
  try {
    mergedPlan = generatePlanV2(planConfigV2);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "plan_generation_failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const computedLockedWeeks = getLockedWeeks(planStart, mergedPlan.length);
  const existingStored = await loadGeneratedPlan();
  const existingLockedSet = new Set(existingStored?.lockedWeeks ?? []);
  const lockedSet = new Set<number>([...computedLockedWeeks, ...existingLockedSet]);
  const existingByWeek = new Map((existingStored?.plan ?? []).map((week) => [week.week, week]));

  mergedPlan = mergedPlan.map((week) => {
    if (!lockedSet.has(week.week)) return week;
    return existingByWeek.get(week.week) ?? week;
  });

  await saveGeneratedPlan(
    config,
    config.level === "NOVICE"
      ? {
          weeks: mergedPlan,
          noviceRuntime: existingStored?.noviceRuntime ?? defaultNoviceRuntimeState(),
        }
      : mergedPlan,
    [...lockedSet].sort((a, b) => a - b),
  );

  return NextResponse.json({
    success: true,
    weeks: mergedPlan.length,
    days: config.days,
    lockedWeeks: [...lockedSet].sort((a, b) => a - b),
  });
}

export async function GET(req: NextRequest) {
  try {
    void req;
    return await regenerateFromSettings();
  } catch (err) {
    console.error("[plans/regenerate] GET failed:", err);
    return NextResponse.json({ error: "Failed to regenerate plan" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    void req;
    return await regenerateFromSettings();
  } catch (err) {
    console.error("[plans/regenerate] POST failed:", err);
    return NextResponse.json({ error: "Failed to regenerate plan" }, { status: 500 });
  }
}
