import prisma from "@/lib/db";
import type { PlanConfig, TrainingWeek } from "@/data/trainingPlan";
import { startOfDayAEST } from "@/lib/dateUtils";

const SINGLETON_ID = "singleton";

function safeJsonParse<T>(value: string): T | null {
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

export async function saveGeneratedPlan(
  config: PlanConfig,
  plan: TrainingWeek[],
  lockedWeeks?: number[],
): Promise<void> {
  const planJson = JSON.stringify(plan);
  const configJson = JSON.stringify(config);
  const lockedWeeksJson =
    lockedWeeks && Array.isArray(lockedWeeks) ? JSON.stringify(lockedWeeks) : null;

  await prisma.generatedPlan.upsert({
    where: { id: SINGLETON_ID },
    update: {
      planJson,
      configJson,
      lockedWeeks: lockedWeeksJson,
    },
    create: {
      id: SINGLETON_ID,
      planJson,
      configJson,
      lockedWeeks: lockedWeeksJson,
    },
  });
}

export async function loadGeneratedPlan(): Promise<{
  plan: TrainingWeek[];
  config: PlanConfig;
  lockedWeeks: number[];
} | null> {
  const row = await prisma.generatedPlan.findUnique({ where: { id: SINGLETON_ID } });
  if (!row) return null;

  const plan = safeJsonParse<TrainingWeek[]>(row.planJson);
  const config = safeJsonParse<PlanConfig>(row.configJson);
  const lockedWeeksRaw = row.lockedWeeks ? safeJsonParse<unknown>(row.lockedWeeks) : [];
  const lockedWeeks =
    Array.isArray(lockedWeeksRaw)
      ? lockedWeeksRaw.map((n) => Number(n)).filter((n) => Number.isFinite(n))
      : [];

  if (!plan || !config) return null;
  return { plan, config, lockedWeeks };
}

export function getLockedWeeks(planStart: Date, totalWeeks = 0): number[] {
  const today = startOfDayAEST(new Date());
  const locks: number[] = [];
  if (totalWeeks <= 0) return locks;
  for (let week = 1; week <= totalWeeks; week++) {
    const weekEnd = new Date(planStart.getTime() + week * 7 * 24 * 60 * 60 * 1000);
    if (weekEnd < today) locks.push(week);
  }
  return locks;
}

