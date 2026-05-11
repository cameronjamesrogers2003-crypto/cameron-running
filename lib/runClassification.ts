import type { Activity } from "@prisma/client";
import type { RunType, TrainingWeek } from "@/data/trainingPlan";
import { sameDayAEST } from "@/lib/dateUtils";
import { getPlanWeekForDate, getSessionDate } from "@/lib/planUtils";
import { classifyRunByPaceZones } from "@/lib/rating";
import {
  getVdotFallbackLongRunThresholdKm,
} from "@/lib/longRunThreshold";
import type { UserSettings } from "@/lib/settings";

export {
  getDynamicLongRunThresholdKm,
  getVdotFallbackLongRunThresholdKm,
} from "@/lib/longRunThreshold";

interface SplitMetric {
  distance: number;
  average_speed: number;
}

export interface PaceVarianceAnalysis {
  cv: number | null;
  fastestKmPaceSec: number | null;
  slowestKmPaceSec: number | null;
  hasHighVariance: boolean;
  hasIntervalPattern: boolean;
}

export interface PlanContext {
  isPlannedIntervalDay: boolean;
  isPlannedTempoDay: boolean;
  isPlannedLongDay: boolean;
  isPlannedEasyDay: boolean;
}

export interface ClassificationResult {
  runType: RunType;
  method: string;
}

const EMPTY_PLAN_CONTEXT: PlanContext = {
  isPlannedIntervalDay: false,
  isPlannedTempoDay: false,
  isPlannedLongDay: false,
  isPlannedEasyDay: false,
};

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function formatPaceSeconds(sec: number): string {
  const mins = Math.floor(sec / 60);
  const secs = Math.round(sec % 60);
  return `${mins}:${String(secs).padStart(2, "0")}/km`;
}

function safeParseSplits(splitsJson: any | null): SplitMetric[] {
  if (!splitsJson) return [];
  try {
    const parsed: unknown = typeof splitsJson === "string" ? JSON.parse(splitsJson) : splitsJson;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry): entry is SplitMetric => {
      if (!entry || typeof entry !== "object") return false;
      const split = entry as Record<string, unknown>;
      return typeof split.distance === "number" && typeof split.average_speed === "number";
    });
  } catch {
    return [];
  }
}

export function analyzePaceVariance(
  splitsJson: any | null,
  intervalPaceMaxSec = 330,
): PaceVarianceAnalysis {
  const splitPaces = safeParseSplits(splitsJson)
    .filter((split) => split.distance >= 500 && split.average_speed > 0)
    .map((split) => 1000 / split.average_speed);

  if (splitPaces.length < 2) {
    return {
      cv: null,
      fastestKmPaceSec: null,
      slowestKmPaceSec: null,
      hasHighVariance: false,
      hasIntervalPattern: false,
    };
  }

  const mean = splitPaces.reduce((acc, pace) => acc + pace, 0) / splitPaces.length;
  const variance = splitPaces.reduce((acc, pace) => acc + (pace - mean) ** 2, 0) / splitPaces.length;
  const stdDev = Math.sqrt(variance);
  const cv = (stdDev / mean) * 100;
  const fastestKmPaceSec = Math.min(...splitPaces);
  const slowestKmPaceSec = Math.max(...splitPaces);
  const hasHighVariance = cv > 15;
  const hasIntervalPattern = hasHighVariance && fastestKmPaceSec < intervalPaceMaxSec;

  return {
    cv,
    fastestKmPaceSec,
    slowestKmPaceSec,
    hasHighVariance,
    hasIntervalPattern,
  };
}

export function getPlanContextForDate(
  date: Date,
  plan: TrainingWeek[],
  planStart: Date,
): PlanContext {
  const weekNum = getPlanWeekForDate(date, planStart);
  if (weekNum <= 0 || weekNum > plan.length) return EMPTY_PLAN_CONTEXT;

  const planWeek = plan[weekNum - 1];
  const matchingSession = planWeek.sessions.find((session) =>
    sameDayAEST(date, getSessionDate(weekNum, session.day, planStart)));

  return {
    isPlannedIntervalDay: matchingSession?.type === "interval",
    isPlannedTempoDay: matchingSession?.type === "tempo",
    isPlannedLongDay: matchingSession?.type === "long",
    isPlannedEasyDay: matchingSession?.type === "easy",
  };
}

export function enhancedClassifyRun(
  activity: Pick<Activity, "distanceKm" | "avgPaceSecKm" | "splitsJson">,
  settings: UserSettings,
  planContext: PlanContext = EMPTY_PLAN_CONTEXT,
  longRunThresholdKm?: number,
  longRunDistanceMethod?: string,
): ClassificationResult {
  if (planContext.isPlannedLongDay) {
    return {
      runType: "long",
      method: "Plan context (scheduled long run day)",
    };
  }

  const longThresholdKm =
    longRunThresholdKm ?? getVdotFallbackLongRunThresholdKm(settings);
  const distanceLongMethod =
    longRunDistanceMethod
    ?? `Distance rule (>= ${round1(longThresholdKm)}km · VDOT ${settings.currentVdot ?? 33} fallback · insufficient history)`;

  if (activity.distanceKm >= longThresholdKm) {
    return {
      runType: "long",
      method: distanceLongMethod,
    };
  }

  const variance = analyzePaceVariance(activity.splitsJson, settings.intervalPaceMaxSec);
  const cv = variance.cv;
  const fastest = variance.fastestKmPaceSec;

  if (cv != null && cv > 15) {
    if (fastest != null && fastest < settings.intervalPaceMaxSec) {
      return {
        runType: "interval",
        method: `Pace variance analysis (CV: ${round1(cv)}%, fastest km: ${formatPaceSeconds(fastest)})`,
      };
    }
    if (cv > 20) {
      return { runType: "interval", method: `Pace variance analysis (very high CV: ${round1(cv)}%)` };
    }
  }

  if (planContext.isPlannedIntervalDay && cv != null && cv > 10 && cv <= 15) {
    if (fastest != null && fastest < settings.tempoPaceMaxSec) {
      return {
        runType: "interval",
        method: `Plan context (interval day) + pace variance (CV: ${round1(cv)}%)`,
      };
    }
  }

  const baseType = classifyRunByPaceZones(
    activity.avgPaceSecKm,
    activity.distanceKm,
    settings.intervalPaceMaxSec,
    settings.tempoPaceMaxSec,
    longThresholdKm,
  );

  if (planContext.isPlannedIntervalDay && cv != null && cv > 8 && baseType === "tempo") {
    return {
      runType: "interval",
      method: `Plan context (interval day) + pace (CV: ${round1(cv)}%)`,
    };
  }
  if (planContext.isPlannedTempoDay && cv != null && cv > 8 && baseType === "easy") {
    return {
      runType: "tempo",
      method: `Plan context (tempo day) + pace (CV: ${round1(cv)}%)`,
    };
  }

  return {
    runType: baseType,
    method: `Average pace (${formatPaceSeconds(activity.avgPaceSecKm)})`,
  };
}

