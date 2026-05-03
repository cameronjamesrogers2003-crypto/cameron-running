import { NextResponse } from "next/server";
import { addDays } from "date-fns";
import prisma from "@/lib/db";
import { plans, type PlanId } from "@/lib/plans";

export const dynamic = "force-dynamic";

const SESSION_TYPE_MAP: Record<string, string> = {
  easy: "EASY",
  sorta_long: "SORTA_LONG",
  long: "LONG",
  cross: "CROSS",
  rest: "REST",
  race_5k: "RACE_5K",
  race_10k: "RACE_10K",
  race_half: "RACE_HALF",
  race_marathon: "RACE_MARATHON",
};

// dayKey → 0-based offset from Monday (Mon=0 … Sun=6)
const DAY_OFFSET: Record<string, number> = {
  mon: 0, tue: 1, wed: 2, thu: 3, fri: 4, sat: 5, sun: 6,
};

const TRAINING_DAY_KEYS = ["wed", "sat", "sun"] as const;

export async function POST() {
  const settings = await prisma.settings.findUnique({ where: { id: 1 } });
  if (!settings?.planStartDate) {
    return NextResponse.json({ error: "plan_start_date_not_set" }, { status: 400 });
  }

  const existing = await prisma.trainingPlan.findFirst({
    where: { profileId: 1, status: "ACTIVE" },
  });
  if (existing) {
    return NextResponse.json({ error: "plan_already_exists", planId: existing.id }, { status: 409 });
  }

  const planId = (settings.activePlan as PlanId) ?? "half";
  const weekPlans = plans[planId];
  const planStart = new Date(settings.planStartDate);
  const raceDate = addDays(planStart, weekPlans.length * 7);

  const plan = await prisma.trainingPlan.create({
    data: {
      profileId: 1,
      templateKey: planId,
      startDate: planStart,
      raceDate,
      status: "ACTIVE",
    },
  });

  let sessionsCreated = 0;

  for (let weekIdx = 0; weekIdx < weekPlans.length; weekIdx++) {
    const week = weekPlans[weekIdx];

    for (const dayKey of TRAINING_DAY_KEYS) {
      const workout = week[dayKey as keyof typeof week] as import("@/lib/plans").DayWorkout;
      if (workout.type === "rest") continue;

      const sessionType = SESSION_TYPE_MAP[workout.type] ?? "EASY";
      const distanceKm = workout.distanceKm ?? 0;
      const sessionDate = addDays(planStart, weekIdx * 7 + DAY_OFFSET[dayKey]);

      const planned = await prisma.plannedSession.create({
        data: {
          planId: plan.id,
          weekNumber: week.week,
          dayOfWeek: DAY_OFFSET[dayKey],
          sessionType: sessionType as import("@prisma/client").SessionType,
          distanceKm,
          notes: null,
        },
      });

      await prisma.scheduledSession.create({
        data: {
          planId: plan.id,
          plannedSessionId: planned.id,
          date: sessionDate,
          sessionType: sessionType as import("@prisma/client").SessionType,
          currentDistanceKm: distanceKm,
          originalDistanceKm: distanceKm,
          status: "SCHEDULED",
        },
      });

      sessionsCreated++;
    }
  }

  return NextResponse.json({ ok: true, planId: plan.id, sessionsCreated });
}
