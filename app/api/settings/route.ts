import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { dbSettingsToUserSettings, DEFAULT_SETTINGS } from "@/lib/settings";

export async function GET() {
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
    },
  });
  return NextResponse.json(dbSettingsToUserSettings(row));
}

const ALLOWED_FIELDS = new Set([
  "planStartDate", "currentWeekOverride", "phaseOverride",
  "maxHR", "startingTempoPaceSec", "currentVdot",
  "targetHMTimeSec", "raceName", "raceDate",
  "distTargetEasyM", "distTargetTempoM", "distTargetIntervalM", "distTargetLongM",
]);

export async function PATCH(req: NextRequest) {
  const body = await req.json();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const update: Record<string, any> = {};

  for (const [k, v] of Object.entries(body)) {
    if (!ALLOWED_FIELDS.has(k)) continue;
    if ((k === "planStartDate" || k === "raceDate") && typeof v === "string" && v) {
      update[k] = new Date(v);
    } else {
      update[k] = v;
    }
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
      ...update,
    },
  });

  return NextResponse.json(dbSettingsToUserSettings(row));
}
