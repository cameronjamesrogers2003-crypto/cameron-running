import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { dbSettingsToUserSettings, DEFAULT_SETTINGS } from "@/lib/settings";
import { generatePlan } from "@/lib/generatePlan";
import { saveGeneratedPlan } from "@/lib/planStorage";
import type { Day, PlanConfig, RunType } from "@/data/trainingPlan";

function isDay(x: unknown): x is Day {
  return x === "mon" || x === "tue" || x === "wed" || x === "thu" || x === "fri" || x === "sat" || x === "sun";
}

function isRunType(x: unknown): x is RunType {
  return x === "easy" || x === "tempo" || x === "interval" || x === "long";
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

async function regenerateFromSettings(req: NextRequest) {
  console.log("REGENERATE ENDPOINT HIT");
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
    sessionAssignment: (() => {
      try {
        const parsed = settings.sessionAssignment ? JSON.parse(settings.sessionAssignment) as Record<string, unknown> : {};
        const out: Partial<Record<Day, RunType>> = {};
        for (const [k, v] of Object.entries(parsed)) {
          if (isDay(k) && isRunType(v)) out[k] = v;
        }
        return out as Record<Day, RunType>;
      } catch {
        return {} as Record<Day, RunType>;
      }
    })(),
    vdot: settings.currentVdot ?? 33,
  };
  console.log("REGENERATE CONFIG:", JSON.stringify(config, null, 2));

  const plan = generatePlan(config);
  await saveGeneratedPlan(config, plan);

  return NextResponse.redirect(new URL("/", req.url), { status: 303 });
}

export async function GET(req: NextRequest) {
  try {
    return await regenerateFromSettings(req);
  } catch (err) {
    console.error("[plans/regenerate] GET failed:", err);
    return NextResponse.json({ error: "Failed to regenerate plan" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    return await regenerateFromSettings(req);
  } catch (err) {
    console.error("[plans/regenerate] POST failed:", err);
    return NextResponse.json({ error: "Failed to regenerate plan" }, { status: 500 });
  }
}
