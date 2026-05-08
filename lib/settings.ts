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
  /** day string, e.g. "sat" */
  longRunDay: string | null;
  goalRace: "HALF" | "FULL" | null;
  targetFinishTime: number | null;
  maxHR: number;
  startingTempoPaceSec: number;
  currentVdot: number;
  vdotRaceDistance: string | null;
  vdotRaceMinutes: number | null;
  vdotRaceSeconds: number | null;
  targetHMTimeSec: number;
  raceName: string | null;
  raceDate: string | null;
  distTargetEasyM: number;
  distTargetTempoM: number;
  distTargetIntervalM: number;
  distTargetLongM: number;
  age: number | null;
  gender: string | null;
  weightKg: number | null;
  /** "< 1 year" | "1-3 years" | "3-5 years" | "5+ years" */
  runningExperience: string | null;
  easyPaceOffsetSec: number;
  tempoPaceOffsetSec: number;
  intervalPaceOffsetSec: number;
  longPaceOffsetSec: number;
  easyPaceMinSec: number;
  easyPaceMaxSec: number;
  tempoPaceMinSec: number;
  tempoPaceMaxSec: number;
  intervalPaceMinSec: number;
  intervalPaceMaxSec: number;
  longPaceMinSec: number;
  longPaceMaxSec: number;
  firstName: string | null;
  nickname: string | null;
  lastCutbackInsertedWeek: number | null;
  lastEstimatedVdot: number | null;
  lastVdotCheckDate: string | null;
  lastAdaptationDate: string | null;
}

export const DEFAULT_SETTINGS: UserSettings = {
  id: 1,
  planStartDate: null,
  currentWeekOverride: null,
  phaseOverride: null,
  experienceLevel: null,
  planLengthWeeks: null,
  trainingDays: null,
  longRunDay: null,
  goalRace: null,
  targetFinishTime: null,
  maxHR: 198,
  startingTempoPaceSec: 390,
  currentVdot: 33,
  vdotRaceDistance: "5",
  vdotRaceMinutes: 25,
  vdotRaceSeconds: 0,
  targetHMTimeSec: 6900,
  raceName: null,
  raceDate: null,
  distTargetEasyM: 7000,
  distTargetTempoM: 10000,
  distTargetIntervalM: 8000,
  distTargetLongM: 18000,
  age: null,
  gender: null,
  weightKg: null,
  runningExperience: null,
  easyPaceOffsetSec: 0,
  tempoPaceOffsetSec: 0,
  intervalPaceOffsetSec: 0,
  longPaceOffsetSec: 0,
  easyPaceMinSec: 390,
  easyPaceMaxSec: 450,
  tempoPaceMinSec: 330,
  tempoPaceMaxSec: 390,
  intervalPaceMinSec: 300,
  intervalPaceMaxSec: 330,
  longPaceMinSec: 390,
  longPaceMaxSec: 450,
  firstName: null,
  nickname: null,
  lastCutbackInsertedWeek: null,
  lastEstimatedVdot: null,
  lastVdotCheckDate: null,
  lastAdaptationDate: null,
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
    longRunDay:           row.longRunDay ?? null,
    goalRace:             (row.goalRace as UserSettings["goalRace"]) ?? null,
    targetFinishTime:     row.targetFinishTime ?? null,
    maxHR:                row.maxHR                ?? DEFAULT_SETTINGS.maxHR,
    startingTempoPaceSec: row.startingTempoPaceSec ?? DEFAULT_SETTINGS.startingTempoPaceSec,
    currentVdot:          row.currentVdot          ?? DEFAULT_SETTINGS.currentVdot,
    vdotRaceDistance:     row.vdotRaceDistance     ?? DEFAULT_SETTINGS.vdotRaceDistance,
    vdotRaceMinutes:      row.vdotRaceMinutes      ?? DEFAULT_SETTINGS.vdotRaceMinutes,
    vdotRaceSeconds:      row.vdotRaceSeconds      ?? DEFAULT_SETTINGS.vdotRaceSeconds,
    targetHMTimeSec:      row.targetHMTimeSec       ?? DEFAULT_SETTINGS.targetHMTimeSec,
    raceName:             row.raceName              ?? null,
    raceDate:             row.raceDate ? new Date(row.raceDate).toISOString() : null,
    distTargetEasyM:      row.distTargetEasyM       ?? DEFAULT_SETTINGS.distTargetEasyM,
    distTargetTempoM:     row.distTargetTempoM      ?? DEFAULT_SETTINGS.distTargetTempoM,
    distTargetIntervalM:  row.distTargetIntervalM   ?? DEFAULT_SETTINGS.distTargetIntervalM,
    distTargetLongM:      row.distTargetLongM       ?? DEFAULT_SETTINGS.distTargetLongM,
    age:                  row.age                   ?? null,
    gender:               row.gender                ?? null,
    weightKg:             row.weightKg              ?? null,
    runningExperience:    row.runningExperience     ?? null,
    easyPaceOffsetSec:    row.easyPaceOffsetSec     ?? 0,
    tempoPaceOffsetSec:   row.tempoPaceOffsetSec    ?? 0,
    intervalPaceOffsetSec: row.intervalPaceOffsetSec ?? 0,
    longPaceOffsetSec:    row.longPaceOffsetSec     ?? 0,
    easyPaceMinSec:       row.easyPaceMinSec        ?? DEFAULT_SETTINGS.easyPaceMinSec,
    easyPaceMaxSec:       row.easyPaceMaxSec        ?? DEFAULT_SETTINGS.easyPaceMaxSec,
    tempoPaceMinSec:      row.tempoPaceMinSec       ?? DEFAULT_SETTINGS.tempoPaceMinSec,
    tempoPaceMaxSec:      row.tempoPaceMaxSec       ?? DEFAULT_SETTINGS.tempoPaceMaxSec,
    intervalPaceMinSec:   row.intervalPaceMinSec    ?? DEFAULT_SETTINGS.intervalPaceMinSec,
    intervalPaceMaxSec:   row.intervalPaceMaxSec    ?? DEFAULT_SETTINGS.intervalPaceMaxSec,
    longPaceMinSec:       row.longPaceMinSec        ?? DEFAULT_SETTINGS.longPaceMinSec,
    longPaceMaxSec:       row.longPaceMaxSec        ?? DEFAULT_SETTINGS.longPaceMaxSec,
    firstName: row.firstName ?? null,
    nickname: row.nickname ?? null,
    lastCutbackInsertedWeek: row.lastCutbackInsertedWeek ?? null,
    lastEstimatedVdot: row.lastEstimatedVdot ?? null,
    lastVdotCheckDate: row.lastVdotCheckDate ? new Date(row.lastVdotCheckDate).toISOString() : null,
    lastAdaptationDate: row.lastAdaptationDate ? new Date(row.lastAdaptationDate).toISOString() : null,
  };
}

export function getDisplayName(settings: UserSettings): string {
  return settings.nickname ?? settings.firstName ?? "Runner";
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
