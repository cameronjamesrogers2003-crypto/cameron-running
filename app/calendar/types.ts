import type { RunType } from "@/data/trainingPlan";

export interface CalendarRun {
  id: string;
  name: string | null;
  dateIso: string;
  distanceKm: number;
  durationSecs: number;
  avgPaceSecKm: number;
  avgHeartRate: number | null;
  maxHeartRate: number | null;
  calories: number | null;
  elevationGainM: number | null;
  temperatureC: number | null;
  humidityPct: number | null;
  activityType: string;
  /** Stored 0–10 from Activity.rating */
  rating: number | null;
  ratingBreakdown?: string | null;
  classificationMethod?: string | null;
  runType: RunType;
  isPlanned: boolean;
}

export type CalendarData = Record<string, CalendarRun[]>;

export type PlannedDayMeta = Record<
  string,
  {
    kind: "planned" | "missed";
    runType: RunType;
  }
>;
