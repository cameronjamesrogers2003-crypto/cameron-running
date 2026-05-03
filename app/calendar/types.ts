import type { RatingResult } from "@/lib/rating";
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
  rating: RatingResult | null;
  runType: RunType;
  isPlanned: boolean;
}

export type CalendarData = Record<string, CalendarRun[]>;
