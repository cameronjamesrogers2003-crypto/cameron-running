import type { UserSettings as PrismaUserSettings } from "@prisma/client";

export interface UserSettings {
  id: number;
  planStartDate: string | null;
  currentWeekOverride: number | null;
  phaseOverride: string | null;
  experienceLevel: "BEGINNER" | "INTERMEDIATE" | "ADVANCED" | null;
  planLengthWeeks: 12 | 16 | 20 | null;
  /** JSON array string, e.g. ["mon","wed","sat"] */
  trainingDays: string | null;
  /** JSON object string, e.g. {"mon":"easy","wed":"interval","sat":"long"} */
  sessionAssignment: string | null;
  goalRace: "HALF" | "FULL" | null;
  targetFinishTime: number | null;
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
  easyPaceMinSec: number;
  easyPaceMaxSec: number;
  tempoPaceMinSec: number;
  tempoPaceMaxSec: number;
  intervalPaceMinSec: number;
  intervalPaceMaxSec: number;
  longPaceMinSec: number;
  longPaceMaxSec: number;
}

export const DEFAULT_SETTINGS: UserSettings = {
  id: 1,
  planStartDate: null,
  currentWeekOverride: null,
  phaseOverride: null,
  experienceLevel: null,
  planLengthWeeks: null,
  trainingDays: null,
  sessionAssignment: null,
  goalRace: null,
  targetFinishTime: null,
  maxHR: 198,
  startingTempoPaceSec: 390,
  currentVdot: 33,
  targetHMTimeSec: 6900,
  raceName: null,
  raceDate: null,
  distTargetEasyM: 7000,
  distTargetTempoM: 10000,
  distTargetIntervalM: 8000,
  distTargetLongM: 18000,
  easyPaceMinSec: 390,
  easyPaceMaxSec: 450,
  tempoPaceMinSec: 330,
  tempoPaceMaxSec: 390,
  intervalPaceMinSec: 300,
  intervalPaceMaxSec: 330,
  longPaceMinSec: 390,
  longPaceMaxSec: 450,
};

export function dbSettingsToUserSettings(row: PrismaUserSettings): UserSettings {
  return {
    id: row.id,
    planStartDate:        row.planStartDate  ? new Date(row.planStartDate).toISOString()  : null,
    currentWeekOverride:  row.currentWeekOverride  ?? null,
    phaseOverride:        row.phaseOverride        ?? null,
    experienceLevel:      (row.experienceLevel as UserSettings["experienceLevel"]) ?? null,
    planLengthWeeks:      (row.planLengthWeeks as UserSettings["planLengthWeeks"]) ?? null,
    trainingDays:         row.trainingDays ?? null,
    sessionAssignment:    row.sessionAssignment ?? null,
    goalRace:             (row.goalRace as UserSettings["goalRace"]) ?? null,
    targetFinishTime:     row.targetFinishTime ?? null,
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
    easyPaceMinSec:       row.easyPaceMinSec        ?? DEFAULT_SETTINGS.easyPaceMinSec,
    easyPaceMaxSec:       row.easyPaceMaxSec        ?? DEFAULT_SETTINGS.easyPaceMaxSec,
    tempoPaceMinSec:      row.tempoPaceMinSec       ?? DEFAULT_SETTINGS.tempoPaceMinSec,
    tempoPaceMaxSec:      row.tempoPaceMaxSec       ?? DEFAULT_SETTINGS.tempoPaceMaxSec,
    intervalPaceMinSec:   row.intervalPaceMinSec    ?? DEFAULT_SETTINGS.intervalPaceMinSec,
    intervalPaceMaxSec:   row.intervalPaceMaxSec    ?? DEFAULT_SETTINGS.intervalPaceMaxSec,
    longPaceMinSec:       row.longPaceMinSec        ?? DEFAULT_SETTINGS.longPaceMinSec,
    longPaceMaxSec:       row.longPaceMaxSec        ?? DEFAULT_SETTINGS.longPaceMaxSec,
  };
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
