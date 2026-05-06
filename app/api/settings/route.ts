import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { dbSettingsToUserSettings, DEFAULT_SETTINGS } from "@/lib/settings";

type SettingsUpdate = {
  planStartDate?: Date | null;
  currentWeekOverride?: number | null;
  phaseOverride?: string | null;
  experienceLevel?: "BEGINNER" | "INTERMEDIATE" | "ADVANCED" | null;
  goalRace?: "HALF" | "FULL" | null;
  planLengthWeeks?: 12 | 16 | 20 | null;
  trainingDays?: string | null;
  sessionAssignment?: string | null;
  targetFinishTime?: number | null;
  maxHR?: number;
  startingTempoPaceSec?: number;
  currentVdot?: number;
  targetHMTimeSec?: number;
  raceName?: string | null;
  raceDate?: Date | null;
  distTargetEasyM?: number;
  distTargetTempoM?: number;
  distTargetIntervalM?: number;
  distTargetLongM?: number;
  easyPaceMinSec?: number;
  easyPaceMaxSec?: number;
  tempoPaceMinSec?: number;
  tempoPaceMaxSec?: number;
  intervalPaceMinSec?: number;
  intervalPaceMaxSec?: number;
  longPaceMinSec?: number;
  longPaceMaxSec?: number;
};

export async function GET() {
  try {
    const row = await prisma.userSettings.upsert({
      where:  { id: 1 },
      update: {},
      create: {
        id:                   1,
        maxHR:                DEFAULT_SETTINGS.maxHR,
        startingTempoPaceSec: DEFAULT_SETTINGS.startingTempoPaceSec,
        currentVdot:          DEFAULT_SETTINGS.currentVdot,
        targetHMTimeSec:      DEFAULT_SETTINGS.targetHMTimeSec,
        distTargetEasyM:      DEFAULT_SETTINGS.distTargetEasyM,
        distTargetTempoM:     DEFAULT_SETTINGS.distTargetTempoM,
        distTargetIntervalM:  DEFAULT_SETTINGS.distTargetIntervalM,
        distTargetLongM:      DEFAULT_SETTINGS.distTargetLongM,
        easyPaceMinSec:       DEFAULT_SETTINGS.easyPaceMinSec,
        easyPaceMaxSec:       DEFAULT_SETTINGS.easyPaceMaxSec,
        tempoPaceMinSec:      DEFAULT_SETTINGS.tempoPaceMinSec,
        tempoPaceMaxSec:      DEFAULT_SETTINGS.tempoPaceMaxSec,
        intervalPaceMinSec:   DEFAULT_SETTINGS.intervalPaceMinSec,
        intervalPaceMaxSec:   DEFAULT_SETTINGS.intervalPaceMaxSec,
        longPaceMinSec:       DEFAULT_SETTINGS.longPaceMinSec,
        longPaceMaxSec:       DEFAULT_SETTINGS.longPaceMaxSec,
      },
    });
    return NextResponse.json(dbSettingsToUserSettings(row));
  } catch (err) {
    console.error("[settings] fetch failed:", err);
    return NextResponse.json({ error: "Failed to fetch settings" }, { status: 500 });
  }
}

const ALLOWED_FIELDS = new Set([
  "planStartDate", "currentWeekOverride", "phaseOverride",
  "experienceLevel", "goalRace", "planLengthWeeks", "trainingDays", "sessionAssignment", "targetFinishTime",
  "maxHR", "startingTempoPaceSec", "currentVdot",
  "targetHMTimeSec", "raceName", "raceDate",
  "distTargetEasyM", "distTargetTempoM", "distTargetIntervalM", "distTargetLongM",
  "easyPaceMinSec", "easyPaceMaxSec",
  "tempoPaceMinSec", "tempoPaceMaxSec",
  "intervalPaceMinSec", "intervalPaceMaxSec",
  "longPaceMinSec", "longPaceMaxSec",
]);

function applySetting(update: SettingsUpdate, key: string, value: unknown): void {
  switch (key) {
    case "planStartDate":
      update.planStartDate = typeof value === "string" && value ? new Date(value) : null;
      return;
    case "raceDate":
      update.raceDate = typeof value === "string" && value ? new Date(value) : null;
      return;
    case "phaseOverride":
      if (typeof value === "string" || value === null) update.phaseOverride = value;
      return;
    case "experienceLevel":
      if (value === "BEGINNER" || value === "INTERMEDIATE" || value === "ADVANCED" || value === null) {
        update.experienceLevel = value;
      }
      return;
    case "goalRace":
      if (value === "HALF" || value === "FULL" || value === null) update.goalRace = value;
      return;
    case "planLengthWeeks":
      if (value === 12 || value === 16 || value === 20 || value === null) {
        update.planLengthWeeks = value;
      }
      return;
    case "trainingDays":
      if (typeof value === "string" || value === null) update.trainingDays = value;
      return;
    case "sessionAssignment":
      if (typeof value === "string" || value === null) update.sessionAssignment = value;
      return;
    case "targetFinishTime":
      if (typeof value === "number" || value === null) update.targetFinishTime = value;
      return;
    case "raceName":
      if (typeof value === "string" || value === null) update.raceName = value;
      return;
    case "currentWeekOverride":
      if (typeof value === "number" || value === null) update.currentWeekOverride = value;
      return;
    case "maxHR":
      if (typeof value === "number") update.maxHR = value;
      return;
    case "startingTempoPaceSec":
      if (typeof value === "number") update.startingTempoPaceSec = value;
      return;
    case "currentVdot":
      if (typeof value === "number") update.currentVdot = value;
      return;
    case "targetHMTimeSec":
      if (typeof value === "number") update.targetHMTimeSec = value;
      return;
    case "distTargetEasyM":
      if (typeof value === "number") update.distTargetEasyM = value;
      return;
    case "distTargetTempoM":
      if (typeof value === "number") update.distTargetTempoM = value;
      return;
    case "distTargetIntervalM":
      if (typeof value === "number") update.distTargetIntervalM = value;
      return;
    case "distTargetLongM":
      if (typeof value === "number") update.distTargetLongM = value;
      return;
    case "easyPaceMinSec":
      if (typeof value === "number") update.easyPaceMinSec = value;
      return;
    case "easyPaceMaxSec":
      if (typeof value === "number") update.easyPaceMaxSec = value;
      return;
    case "tempoPaceMinSec":
      if (typeof value === "number") update.tempoPaceMinSec = value;
      return;
    case "tempoPaceMaxSec":
      if (typeof value === "number") update.tempoPaceMaxSec = value;
      return;
    case "intervalPaceMinSec":
      if (typeof value === "number") update.intervalPaceMinSec = value;
      return;
    case "intervalPaceMaxSec":
      if (typeof value === "number") update.intervalPaceMaxSec = value;
      return;
    case "longPaceMinSec":
      if (typeof value === "number") update.longPaceMinSec = value;
      return;
    case "longPaceMaxSec":
      if (typeof value === "number") update.longPaceMaxSec = value;
      return;
  }
}

export async function PATCH(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json() as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  try {
    const update: SettingsUpdate = {};

    for (const [k, v] of Object.entries(body)) {
      if (!ALLOWED_FIELDS.has(k)) continue;
      applySetting(update, k, v);
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: "No valid fields" }, { status: 400 });
    }

    const row = await prisma.userSettings.upsert({
      where:  { id: 1 },
      update,
      create: {
        id: 1,
        maxHR:                DEFAULT_SETTINGS.maxHR,
        startingTempoPaceSec: DEFAULT_SETTINGS.startingTempoPaceSec,
        currentVdot:          DEFAULT_SETTINGS.currentVdot,
        targetHMTimeSec:      DEFAULT_SETTINGS.targetHMTimeSec,
        distTargetEasyM:      DEFAULT_SETTINGS.distTargetEasyM,
        distTargetTempoM:     DEFAULT_SETTINGS.distTargetTempoM,
        distTargetIntervalM:  DEFAULT_SETTINGS.distTargetIntervalM,
        distTargetLongM:      DEFAULT_SETTINGS.distTargetLongM,
        easyPaceMinSec:       DEFAULT_SETTINGS.easyPaceMinSec,
        easyPaceMaxSec:       DEFAULT_SETTINGS.easyPaceMaxSec,
        tempoPaceMinSec:      DEFAULT_SETTINGS.tempoPaceMinSec,
        tempoPaceMaxSec:      DEFAULT_SETTINGS.tempoPaceMaxSec,
        intervalPaceMinSec:   DEFAULT_SETTINGS.intervalPaceMinSec,
        intervalPaceMaxSec:   DEFAULT_SETTINGS.intervalPaceMaxSec,
        longPaceMinSec:       DEFAULT_SETTINGS.longPaceMinSec,
        longPaceMaxSec:       DEFAULT_SETTINGS.longPaceMaxSec,
        ...update,
      },
    });

    return NextResponse.json(dbSettingsToUserSettings(row));
  } catch (err) {
    console.error("[settings] update failed:", err);
    return NextResponse.json({ error: "Failed to update settings" }, { status: 500 });
  }
}
