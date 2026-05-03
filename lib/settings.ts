import { getPlanWeekForDate } from "@/lib/planUtils";
import { trainingPlan } from "@/data/trainingPlan";
import type { Phase } from "@/data/trainingPlan";

export interface UserSettings {
  id: number;
  planStartDate: string | null;
  currentWeekOverride: number | null;
  phaseOverride: string | null;
  maxHR: number;
  startingTempoPaceSec: number;
  currentVdot: number;
  targetHMTimeSec: number;
  raceName: string | null;
  raceDate: string | null;
  distTargetEasyM: number;
  distTargetTempoM: number;
  distTargetIntervalM: number;
  distTargetLongM: number;
}

export const DEFAULT_SETTINGS: UserSettings = {
  id: 1,
  planStartDate: null,
  currentWeekOverride: null,
  phaseOverride: null,
  maxHR: 192,
  startingTempoPaceSec: 390,
  currentVdot: 33,
  targetHMTimeSec: 6900,
  raceName: null,
  raceDate: null,
  distTargetEasyM: 7000,
  distTargetTempoM: 10000,
  distTargetIntervalM: 8000,
  distTargetLongM: 18000,
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function dbSettingsToUserSettings(row: any): UserSettings {
  return {
    id: row.id,
    planStartDate:        row.planStartDate  ? new Date(row.planStartDate).toISOString()  : null,
    currentWeekOverride:  row.currentWeekOverride  ?? null,
    phaseOverride:        row.phaseOverride        ?? null,
    maxHR:                row.maxHR                ?? DEFAULT_SETTINGS.maxHR,
    startingTempoPaceSec: row.startingTempoPaceSec ?? DEFAULT_SETTINGS.startingTempoPaceSec,
    currentVdot:          row.currentVdot          ?? DEFAULT_SETTINGS.currentVdot,
    targetHMTimeSec:      row.targetHMTimeSec       ?? DEFAULT_SETTINGS.targetHMTimeSec,
    raceName:             row.raceName              ?? null,
    raceDate:             row.raceDate ? new Date(row.raceDate).toISOString() : null,
    distTargetEasyM:      row.distTargetEasyM       ?? DEFAULT_SETTINGS.distTargetEasyM,
    distTargetTempoM:     row.distTargetTempoM      ?? DEFAULT_SETTINGS.distTargetTempoM,
    distTargetIntervalM:  row.distTargetIntervalM   ?? DEFAULT_SETTINGS.distTargetIntervalM,
    distTargetLongM:      row.distTargetLongM       ?? DEFAULT_SETTINGS.distTargetLongM,
  };
}

export function deriveCurrentWeek(settings: UserSettings): number {
  if (settings.currentWeekOverride != null) return settings.currentWeekOverride;
  return getPlanWeekForDate(new Date());
}

export function deriveCurrentPhase(settings: UserSettings): Phase {
  if (settings.phaseOverride) return settings.phaseOverride as Phase;
  const week = deriveCurrentWeek(settings);
  const planWeek = trainingPlan.find(w => w.week === week);
  return planWeek?.phase ?? "Base";
}

export function formatPace(secPerKm: number): string {
  const mins = Math.floor(secPerKm / 60);
  const secs = Math.round(secPerKm % 60);
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

export function parsePace(str: string): number | null {
  const match = str.trim().match(/^(\d+):(\d{1,2})$/);
  if (!match) return null;
  const mins = parseInt(match[1], 10);
  const secs = parseInt(match[2], 10);
  if (secs >= 60) return null;
  return mins * 60 + secs;
}

export function formatDuration(totalSecs: number): string {
  const h = Math.floor(totalSecs / 3600);
  const m = Math.floor((totalSecs % 3600) / 60);
  const s = totalSecs % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function parseDuration(str: string): number | null {
  const parts = str.trim().split(":").map(Number);
  if (parts.some(isNaN)) return null;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return null;
}
