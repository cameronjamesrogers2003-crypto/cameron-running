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
  let tempoSecKm = p.tempoSecKm + tempoOff;
  let intervalSecKm = p.intervalSecKm + intOff;
  const longBase = Math.round(p.easyMaxSecKm * 1.1);
  const longSecKm = longBase + longOff;

  if (isBeginnerRunningExperience(settings.runningExperience)) {
    tempoSecKm += Math.round(p.tempoSecKm * 0.05);
    intervalSecKm += Math.round(p.intervalSecKm * 0.05);
  }

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
    return base + Math.round(base * 0.05);
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

  let tempoMid = p.tempoSecKm + tempoOff;
  let intMid = p.intervalSecKm + intOff;
  if (isBeginnerRunningExperience(settings.runningExperience)) {
    tempoMid += Math.round(p.tempoSecKm * 0.05);
    intMid += Math.round(p.intervalSecKm * 0.05);
  }

  const longMid = Math.round(p.easyMaxSecKm * 1.1) + longOff;

  return {
    easyPaceMinSec: easyMin,
    easyPaceMaxSec: easyMax,
    tempoPaceMinSec: Math.max(120, tempoMid - 30),
    tempoPaceMaxSec: tempoMid + 30,
    intervalPaceMinSec: Math.max(120, intMid - 15),
    intervalPaceMaxSec: intMid + 15,
    longPaceMinSec: Math.max(120, longMid - 20),
    longPaceMaxSec: longMid + 20,
  };
}
