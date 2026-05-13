import prisma from "@/lib/db";
import type { PlanConfig, TrainingWeek } from "@/data/trainingPlan";
import type { GeneratedPlanBundle, NovicePlanRuntimeState } from "@/types/generatedPlan";
import { defaultNoviceRuntimeState } from "@/types/generatedPlan";
import { startOfDayAEST, toBrisbaneYmd } from "@/lib/dateUtils";

export const GENERATED_PLAN_ID = "singleton";

const SINGLETON_ID = GENERATED_PLAN_ID;

function safeJsonParse<T>(value: string): T | null {
  try {
    return JSON.parse(value) as T;
  } catch (err) {
    console.error("GeneratedPlan JSON corrupt:", err);
    return null;
  }
}

type PlanJsonV2 = {
  version: 2;
  weeks: TrainingWeek[];
  noviceRuntime?: NovicePlanRuntimeState;
};

export function parseStoredPlanJson(
  planJson: string,
  config: PlanConfig,
): { weeks: TrainingWeek[]; noviceRuntime?: NovicePlanRuntimeState } {
  const parsed = safeJsonParse<unknown>(planJson);
  if (Array.isArray(parsed)) {
    return {
      weeks: parsed as TrainingWeek[],
      noviceRuntime: config.level === "NOVICE" ? defaultNoviceRuntimeState() : undefined,
    };
  }
  if (
    parsed &&
    typeof parsed === "object" &&
    (parsed as PlanJsonV2).version === 2 &&
    Array.isArray((parsed as PlanJsonV2).weeks)
  ) {
    const v2 = parsed as PlanJsonV2;
    return { weeks: v2.weeks, noviceRuntime: v2.noviceRuntime };
  }
  return { weeks: [], noviceRuntime: undefined };
}

export async function saveGeneratedPlan(
  config: PlanConfig,
  planInput: TrainingWeek[] | GeneratedPlanBundle,
  lockedWeeks?: number[],
  noviceRuntimeOverride?: NovicePlanRuntimeState,
): Promise<void> {
  const weeks = Array.isArray(planInput) ? planInput : planInput.weeks;
  let noviceRuntime: NovicePlanRuntimeState | undefined = Array.isArray(planInput)
    ? noviceRuntimeOverride
    : planInput.noviceRuntime ?? noviceRuntimeOverride;

  const existingRow = await prisma.generatedPlan.findUnique({ where: { id: SINGLETON_ID } });
  if (config.level === "NOVICE") {
    if (noviceRuntime == null && existingRow) {
      const prev = parseStoredPlanJson(existingRow.planJson, config);
      noviceRuntime = prev.noviceRuntime ?? defaultNoviceRuntimeState();
    }
    noviceRuntime = noviceRuntime ?? defaultNoviceRuntimeState();
  }

  const payload: PlanJsonV2 = { version: 2, weeks };
  if (config.level === "NOVICE" && noviceRuntime) {
    payload.noviceRuntime = noviceRuntime;
  }

  const planJson = JSON.stringify(payload);
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
  noviceRuntime?: NovicePlanRuntimeState;
} | null> {
  const row = await prisma.generatedPlan.findUnique({ where: { id: SINGLETON_ID } });
  if (!row) return null;

  const config = safeJsonParse<PlanConfig>(row.configJson);
  if (!row.planJson || !config) return null;

  const { weeks, noviceRuntime } = parseStoredPlanJson(row.planJson, config);
  if (!weeks.length) return null;

  const lockedWeeksRaw = row.lockedWeeks ? safeJsonParse<unknown>(row.lockedWeeks) : [];
  const lockedWeeks =
    Array.isArray(lockedWeeksRaw)
      ? lockedWeeksRaw.map((n) => Number(n)).filter((n) => Number.isFinite(n))
      : [];

  return {
    plan: weeks,
    config,
    lockedWeeks,
    noviceRuntime: config.level === "NOVICE" ? noviceRuntime ?? defaultNoviceRuntimeState() : undefined,
  };
}

export function getLockedWeeks(planStart: Date, totalWeeks = 0): number[] {
  const todayYmd = toBrisbaneYmd(startOfDayAEST(new Date()));
  const locks: number[] = [];
  if (totalWeeks <= 0) return locks;
  for (let week = 1; week <= totalWeeks; week++) {
    const weekEnd = new Date(planStart.getTime() + week * 7 * 24 * 60 * 60 * 1000);
    if (toBrisbaneYmd(weekEnd) < todayYmd) locks.push(week);
  }
  return locks;
}

