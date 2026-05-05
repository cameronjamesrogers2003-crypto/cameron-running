import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { dbSettingsToUserSettings, DEFAULT_SETTINGS } from "@/lib/settings";
import type { Prisma } from "@prisma/client";

type SettingsUpdate = Prisma.UserSettingsUpdateInput;

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
  "maxHR", "startingTempoPaceSec", "currentVdot",
  "targetHMTimeSec", "raceName", "raceDate",
  "distTargetEasyM", "distTargetTempoM", "distTargetIntervalM", "distTargetLongM",
  "easyPaceMinSec", "easyPaceMaxSec",
  "tempoPaceMinSec", "tempoPaceMaxSec",
  "intervalPaceMinSec", "intervalPaceMaxSec",
  "longPaceMinSec", "longPaceMaxSec",
]);

function applySetting(update: SettingsUpdate, key: string, value: unknown): void {
  if (key === "planStartDate" || key === "raceDate") {
    if (typeof value === "string" && value) update[key] = new Date(value);
    else update[key] = null;
    return;
  }

  if (key === "phaseOverride" || key === "raceName") {
    if (typeof value === "string" || value === null) update[key] = value;
    return;
  }

  if (
    key === "currentWeekOverride"
    || key === "maxHR"
    || key === "startingTempoPaceSec"
    || key === "currentVdot"
    || key === "targetHMTimeSec"
    || key === "distTargetEasyM"
    || key === "distTargetTempoM"
    || key === "distTargetIntervalM"
    || key === "distTargetLongM"
    || key === "easyPaceMinSec"
    || key === "easyPaceMaxSec"
    || key === "tempoPaceMinSec"
    || key === "tempoPaceMaxSec"
    || key === "intervalPaceMinSec"
    || key === "intervalPaceMaxSec"
    || key === "longPaceMinSec"
    || key === "longPaceMaxSec"
  ) {
    if (typeof value === "number" || (key === "currentWeekOverride" && value === null)) {
      update[key] = value;
    }
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
