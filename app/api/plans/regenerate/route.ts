import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { dbSettingsToUserSettings, DEFAULT_SETTINGS } from "@/lib/settings";
import { generatePlan } from "@/lib/generatePlan";
import { getLockedWeeks, loadGeneratedPlan, saveGeneratedPlan } from "@/lib/planStorage";
import { getEffectivePlanStart, parsePlanFirstSessionDay } from "@/lib/planUtils";
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

  const config: PlanConfig = {
    level: settings.experienceLevel,
    goal: settings.goalRace === "FULL" ? "full" : "hm",
    weeks: (settings.planLengthWeeks ?? 16) as 12 | 16 | 20,
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
  const generatedPlan = generatePlan(config);
  const planStart = getEffectivePlanStart(settings.planStartDate, parsePlanFirstSessionDay(settings.trainingDays));
  const computedLockedWeeks = getLockedWeeks(planStart, generatedPlan.length);
  const existingStored = await loadGeneratedPlan();
  const existingLockedSet = new Set(existingStored?.lockedWeeks ?? []);
  const lockedSet = new Set<number>([...computedLockedWeeks, ...existingLockedSet]);
  const existingByWeek = new Map((existingStored?.plan ?? []).map((week) => [week.week, week]));

  const mergedPlan = generatedPlan.map((week) => {
    if (!lockedSet.has(week.week)) return week;
    return existingByWeek.get(week.week) ?? week;
  });

  await saveGeneratedPlan(config, mergedPlan, [...lockedSet].sort((a, b) => a - b));

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
