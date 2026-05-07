import { getVdotPaces } from "@/lib/vdot";
import type { UserSettings } from "@/lib/settings";

export const RUNNING_EXPERIENCE_LT1 = "< 1 year";
export const RUNNING_EXPERIENCE_1_3 = "1-3 years";
export const RUNNING_EXPERIENCE_3_5 = "3-5 years";
export const RUNNING_EXPERIENCE_5PLUS = "5+ years";

/** True when beginner safety buffer applies to tempo/interval (5% of raw VDOT pace, in addition to offset). */
export function isBeginnerRunningExperience(runningExperience: string | null | undefined): boolean {
  return runningExperience === RUNNING_EXPERIENCE_LT1;
}

export interface SessionPacesSecKm {
  easySecKm: number;
  tempoSecKm: number;
  intervalSecKm: number;
  longSecKm: number;
}

/**
 * Target session paces in sec/km from VDOT table + offsets + "< 1 year" buffer (tempo/interval only).
 * Long run: easyMaxSecKm * 1.1 + longPaceOffsetSec (rounded base before offset).
 */
export function getSessionPacesSecKm(vdot: number, settings: Partial<UserSettings>): SessionPacesSecKm {
  const p = getVdotPaces(vdot);
  const easyOff = settings.easyPaceOffsetSec ?? 0;
  const tempoOff = settings.tempoPaceOffsetSec ?? 0;
  const intOff = settings.intervalPaceOffsetSec ?? 0;
  const longOff = settings.longPaceOffsetSec ?? 0;

  const easySecKm = p.easyMaxSecKm + easyOff;
  let tempoSecKm: number;
  let intervalSecKm: number;
  if (isBeginnerRunningExperience(settings.runningExperience)) {
    tempoSecKm = Math.round(p.tempoSecKm * 1.05 + tempoOff);
    intervalSecKm = Math.round(p.intervalSecKm * 1.05 + intOff);
  } else {
    tempoSecKm = p.tempoSecKm + tempoOff;
    intervalSecKm = p.intervalSecKm + intOff;
  }
  const longBase = Math.round(p.easyMaxSecKm * 1.1);
  const longSecKm = longBase + longOff;

  return { easySecKm, tempoSecKm, intervalSecKm, longSecKm };
}

/** Pace at offset 0 on the zone slider (VDOT table + beginner display buffer for tempo/interval). */
export function getSliderBaseSecKm(
  zone: "easy" | "tempo" | "interval" | "long",
  vdot: number,
  runningExperience: string | null | undefined,
): number {
  const p = getVdotPaces(vdot);
  if (zone === "easy") return p.easyMaxSecKm;
  if (zone === "long") return Math.round(p.easyMaxSecKm * 1.1);
  const base = zone === "tempo" ? p.tempoSecKm : p.intervalSecKm;
  if (isBeginnerRunningExperience(runningExperience)) {
    return Math.round(base * 1.05);
  }
  return base;
}

export function getSessionPacesMinPerKm(vdot: number, settings: Partial<UserSettings>): {
  easy: number;
  tempo: number;
  interval: number;
  long: number;
} {
  const s = getSessionPacesSecKm(vdot, settings);
  return {
    easy: s.easySecKm / 60,
    tempo: s.tempoSecKm / 60,
    interval: s.intervalSecKm / 60,
    long: s.longSecKm / 60,
  };
}

/**
 * Min/max sec/km for rating & classification, derived from VDOT + offsets + beginner buffers.
 */
export function deriveRatingPaceZones(settings: UserSettings): Pick<
  UserSettings,
  | "easyPaceMinSec"
  | "easyPaceMaxSec"
  | "tempoPaceMinSec"
  | "tempoPaceMaxSec"
  | "intervalPaceMinSec"
  | "intervalPaceMaxSec"
  | "longPaceMinSec"
  | "longPaceMaxSec"
> {
  const vdot = settings.currentVdot;
  const p = getVdotPaces(vdot);
  const easyOff = settings.easyPaceOffsetSec ?? 0;
  const tempoOff = settings.tempoPaceOffsetSec ?? 0;
  const intOff = settings.intervalPaceOffsetSec ?? 0;
  const longOff = settings.longPaceOffsetSec ?? 0;

  const easyMin = p.easyMinSecKm + easyOff;
  const easyMax = p.easyMaxSecKm + easyOff;

  let tempoPaceMaxSec: number;
  let tempoPaceMinSec: number;
  let intervalPaceMaxSec: number;
  let intervalPaceMinSec: number;
  if (isBeginnerRunningExperience(settings.runningExperience)) {
    tempoPaceMaxSec = Math.round(p.tempoSecKm * 1.05 + tempoOff);
    intervalPaceMaxSec = Math.round(p.intervalSecKm * 1.05 + intOff);
    tempoPaceMinSec = Math.max(120, tempoPaceMaxSec - 60);
    intervalPaceMinSec = Math.max(120, intervalPaceMaxSec - 30);
  } else {
    const tempoMid = p.tempoSecKm + tempoOff;
    const intMid = p.intervalSecKm + intOff;
    tempoPaceMaxSec = tempoMid + 30;
    tempoPaceMinSec = Math.max(120, tempoMid - 30);
    intervalPaceMaxSec = intMid + 15;
    intervalPaceMinSec = Math.max(120, intMid - 15);
  }

  const longMid = Math.round(p.easyMaxSecKm * 1.1) + longOff;

  return {
    easyPaceMinSec: easyMin,
    easyPaceMaxSec: easyMax,
    tempoPaceMinSec,
    tempoPaceMaxSec,
    intervalPaceMinSec,
    intervalPaceMaxSec,
    longPaceMinSec: Math.max(120, longMid - 20),
    longPaceMaxSec: longMid + 20,
  };
}
