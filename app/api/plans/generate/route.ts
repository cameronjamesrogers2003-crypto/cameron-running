// ENGINE: generatePlanV2 (evidence-based spec, May 2026)
import type { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import type { Day, PlanConfig, TrainingWeek } from "@/data/trainingPlan";
import { generatePlanV2, type PlanConfigV2 } from "@/lib/generatePlanV2";
import { loadGeneratedPlan, saveGeneratedPlan } from "@/lib/planStorage";
import { prisma } from "@/lib/db";
import { defaultNoviceRuntimeState } from "@/types/generatedPlan";

function isDay(x: unknown): x is Day {
  return x === "mon" || x === "tue" || x === "wed" || x === "thu" || x === "fri" || x === "sat" || x === "sun";
}

function parseConfig(body: unknown): PlanConfig | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;

  const level = b.level;
  const goal = b.goal;
  const weeks = b.weeks;
  const days = b.days;
  const longRunDay = b.longRunDay;
  const vdot = b.vdot;

  if (level !== "NOVICE" && level !== "BEGINNER" && level !== "INTERMEDIATE" && level !== "ADVANCED" && level !== "ELITE") return null;
  if (goal !== "5k" && goal !== "10k" && goal !== "hm" && goal !== "full") return null;
  if (weeks !== 8 && weeks !== 12 && weeks !== 16 && weeks !== 20) return null;
  if (typeof vdot !== "number" || !Number.isFinite(vdot)) return null;
  if (!Array.isArray(days) || days.length < 2 || days.length > 7 || !days.every(isDay)) return null;
  if (longRunDay != null && !isDay(longRunDay)) return null;

  return {
    level,
    goal,
    weeks,
    days: days as Day[],
    longRunDay: longRunDay as Day | undefined,
    vdot,
  };
}

function planGoalToV2(goal: PlanConfig["goal"]): PlanConfigV2["goalDistance"] {
  if (goal === "5k") return "5K";
  if (goal === "10k") return "10K";
  if (goal === "hm") return "HalfMarathon";
  return "Marathon";
}

function levelToV2(level: PlanConfig["level"]): PlanConfigV2["experienceLevel"] {
  if (level === "ELITE") return "ADVANCED";
  return level as PlanConfigV2["experienceLevel"];
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const config = parseConfig(body);
  if (!config) return NextResponse.json({ error: "invalid_config" }, { status: 400 });

  if (config.days.length < 2 || config.days.length > 6) {
    return NextResponse.json({ error: "invalid_config" }, { status: 400 });
  }

  const lockedWeeksInput = (body as { lockedWeeks?: unknown }).lockedWeeks;
  const lockedWeeks =
    Array.isArray(lockedWeeksInput)
      ? lockedWeeksInput.map((n) => Number(n)).filter((n) => Number.isFinite(n))
      : undefined;

  const settingsRow = await prisma.userSettings.findUnique({ where: { id: 1 } });
  const startDate = settingsRow?.planStartDate ? new Date(settingsRow.planStartDate) : new Date();

  const planConfigV2: PlanConfigV2 = {
    goalDistance: planGoalToV2(config.goal),
    experienceLevel: levelToV2(config.level),
    vdot: config.vdot,
    totalWeeks: config.weeks,
    sessionsPerWeek: config.days.length as 2 | 3 | 4 | 5 | 6,
    startDate,
    trainingDays: config.days,
    longRunDay: config.longRunDay,
  };

  let plan: TrainingWeek[];
  try {
    plan = generatePlanV2(planConfigV2);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "plan_generation_failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  if (lockedWeeks && lockedWeeks.length > 0) {
    const lockedSet = new Set(lockedWeeks);
    const existing = await loadGeneratedPlan();
    if (existing) {
      const existingByWeek = new Map(existing.plan.map((w) => [w.week, w]));
      const merged = plan.map((w) => {
        if (!lockedSet.has(w.week)) return w;
        return existingByWeek.get(w.week) ?? w;
      });
      for (const oldWeek of existing.plan) {
        if (lockedSet.has(oldWeek.week) && !merged.some((w) => w.week === oldWeek.week)) {
          merged.push(oldWeek);
        }
      }
      merged.sort((a, b) => a.week - b.week);
      plan = merged;
    }
  }

  await saveGeneratedPlan(
    config,
    {
      weeks: plan,
      noviceRuntime: config.level === "NOVICE" ? defaultNoviceRuntimeState() : undefined,
    },
    lockedWeeks,
  );

  // Mark existing ACTIVE blocks as ABANDONED
  await prisma.trainingBlock.updateMany({
    where: { userId: 1, status: "ACTIVE" },
    data: { status: "ABANDONED" },
  });

  const startDateBlock = settingsRow?.planStartDate ? new Date(settingsRow.planStartDate) : new Date();
  const targetDate = new Date(startDateBlock.getTime() + config.weeks * 7 * 24 * 60 * 60 * 1000);

  // Create new stateful TrainingBlock
  await prisma.trainingBlock.create({
    data: {
      userId: 1,
      status: "ACTIVE",
      startingVdot: config.vdot,
      startingLevel: config.level,
      goalDistanceKm:
        config.goal === "full" ? 42.2 :
        config.goal === "hm" ? 21.1 :
        config.goal === "10k" ? 10.0 : 5.0,
      targetDate: targetDate,
      weeks: {
        create: plan.map((w) => ({
          weekNumber: w.week,
          isCutback: w.isCutback ?? false,
          status: "PLANNED",
          phase: w.phase,
          sessionsJson: w.sessions as unknown as Prisma.InputJsonValue,
        })),
      },
    },
  });

  return NextResponse.json({ plan, vdot: config.vdot });
}
