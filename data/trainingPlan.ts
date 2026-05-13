import type { UserSettings } from "@/lib/settings";
import { generatePlan } from "@/lib/generatePlan";
import { getSessionPaces } from "@/lib/planPaces";

export type RunType = 'easy' | 'tempo' | 'interval' | 'long'
export type Day = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'
export type Phase =
  | 'Base'
  | 'Half Marathon Build'
  | 'Marathon Build'
  | 'Recovery'
  | 'Beginner Base'
  | 'Intermediate Base'
  | 'Advanced Base'
  | 'Race Specific'
  | 'Taper'

export interface PlanPaceAdjust {
  easyPaceOffsetSec: number
  tempoPaceOffsetSec: number
  intervalPaceOffsetSec: number
  longPaceOffsetSec: number
  /** "< 1 year" applies tempo/interval safety buffer */
  runningExperience: string | null
}

export interface PlanConfig {
  level: 'NOVICE' | 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | 'ELITE'
  goal: '5k' | '10k' | 'hm' | 'full'
  weeks: 8 | 12 | 16 | 20
  days: Day[]
  longRunDay?: Day
  vdot: number
  paceAdjust?: PlanPaceAdjust
}

export interface Session {
  id: string
  day: Day
  type: RunType
  targetDistanceKm: number
  targetPaceMinPerKm: number
  targetPaceFormatted?: string
  description: string
  /** Novice-specific structure for managed impact */
  structure?: {
    warmupMin: number
    cooldownMin: number
    runWalkRatio?: {
      runSec: number
      walkSec: number
    }
  }
  targetRpe?: number
  plannedWorkload?: number
}

export interface TrainingWeek {
  week: number
  phase: Phase
  isCutback: boolean
  isRecovery?: boolean
  originalWeek?: number
  softCutback?: boolean
  adaptationNote?: string
  sessions: Session[]
  /** Dynamic subtitle above the week card; generated from actual sessions */
  weekSubtitle?: string
  /** Phase intro shown once per phase section; set on first week of each phase */
  phaseOverviewText?: string
  /** Novice: plan is complete and user may be guided toward Beginner program (Phase 3 uses signals). */
  noviceGraduationEligible?: boolean
  /** Novice: first week number with bridge tempo sessions (same on every week for JSON consumers). */
  noviceTempoWindowStart?: number
}

// Pace zones based on VDOT ~33 — reassess every 6–8 weeks
// Update PACE_ZONES when fitness improves
export const PACE_ZONES = {
  easy: 6.75,       // midpoint of 6:30–7:15
  long: 6.75,       // same as easy
  tempo: 5.42,      // midpoint of 5:15–5:35
  interval: 4.92,   // midpoint of 4:45–5:05
}

export const trainingPlan: TrainingWeek[] = [ // legacy fallback
  // ── Phase 1: Base (Weeks 1–6) ──────────────────────────────────────────────
  {
    week: 1, phase: 'Base', isCutback: false,
    sessions: [
      { id: '1-wed', day: 'wed', type: 'interval', targetDistanceKm: 4,  targetPaceMinPerKm: PACE_ZONES.interval, description: '4×400m @ interval pace' },
      { id: '1-sat', day: 'sat', type: 'long',     targetDistanceKm: 10, targetPaceMinPerKm: PACE_ZONES.long,     description: '10 km long' },
      { id: '1-sun', day: 'sun', type: 'easy',     targetDistanceKm: 6,  targetPaceMinPerKm: PACE_ZONES.easy,     description: '6 km easy' },
    ]
  },
  {
    week: 2, phase: 'Base', isCutback: false,
    sessions: [
      { id: '2-wed', day: 'wed', type: 'easy',     targetDistanceKm: 5,  targetPaceMinPerKm: PACE_ZONES.easy,     description: '5 km easy' },
      { id: '2-sat', day: 'sat', type: 'long',     targetDistanceKm: 12, targetPaceMinPerKm: PACE_ZONES.long,     description: '12 km long' },
      { id: '2-sun', day: 'sun', type: 'easy',     targetDistanceKm: 6,  targetPaceMinPerKm: PACE_ZONES.easy,     description: '6 km easy' },
    ]
  },
  {
    week: 3, phase: 'Base', isCutback: false,
    sessions: [
      { id: '3-wed', day: 'wed', type: 'interval', targetDistanceKm: 5,  targetPaceMinPerKm: PACE_ZONES.interval, description: '5×400m @ interval pace' },
      { id: '3-sat', day: 'sat', type: 'long',     targetDistanceKm: 13, targetPaceMinPerKm: PACE_ZONES.long,     description: '13 km long' },
      { id: '3-sun', day: 'sun', type: 'tempo',    targetDistanceKm: 6,  targetPaceMinPerKm: PACE_ZONES.tempo,    description: '20 min tempo' },
    ]
  },
  {
    week: 4, phase: 'Base', isCutback: true,
    sessions: [
      { id: '4-wed', day: 'wed', type: 'easy',     targetDistanceKm: 5,  targetPaceMinPerKm: PACE_ZONES.easy,     description: '5 km easy' },
      { id: '4-sat', day: 'sat', type: 'long',     targetDistanceKm: 10, targetPaceMinPerKm: PACE_ZONES.long,     description: '10 km long' },
      { id: '4-sun', day: 'sun', type: 'easy',     targetDistanceKm: 6,  targetPaceMinPerKm: PACE_ZONES.easy,     description: '6 km easy' },
    ]
  },
  {
    week: 5, phase: 'Base', isCutback: false,
    sessions: [
      { id: '5-wed', day: 'wed', type: 'interval', targetDistanceKm: 5,  targetPaceMinPerKm: PACE_ZONES.interval, description: '5×400m @ interval pace' },
      { id: '5-sat', day: 'sat', type: 'long',     targetDistanceKm: 14, targetPaceMinPerKm: PACE_ZONES.long,     description: '14 km long' },
      { id: '5-sun', day: 'sun', type: 'tempo',    targetDistanceKm: 6,  targetPaceMinPerKm: PACE_ZONES.tempo,    description: '22 min tempo' },
    ]
  },
  {
    week: 6, phase: 'Base', isCutback: false,
    sessions: [
      { id: '6-wed', day: 'wed', type: 'interval', targetDistanceKm: 6,  targetPaceMinPerKm: PACE_ZONES.interval, description: '4×800m @ interval pace' },
      { id: '6-sat', day: 'sat', type: 'long',     targetDistanceKm: 16, targetPaceMinPerKm: PACE_ZONES.long,     description: '16 km long' },
      { id: '6-sun', day: 'sun', type: 'tempo',    targetDistanceKm: 7,  targetPaceMinPerKm: PACE_ZONES.tempo,    description: '25 min tempo' },
    ]
  },

  // ── Phase 2: Half Marathon Build (Weeks 7–14) ──────────────────────────────
  {
    week: 7, phase: 'Half Marathon Build', isCutback: false,
    sessions: [
      { id: '7-wed', day: 'wed', type: 'interval', targetDistanceKm: 6,  targetPaceMinPerKm: PACE_ZONES.interval, description: '4×800m @ interval pace' },
      { id: '7-sat', day: 'sat', type: 'long',     targetDistanceKm: 17, targetPaceMinPerKm: PACE_ZONES.long,     description: '17 km long' },
      { id: '7-sun', day: 'sun', type: 'tempo',    targetDistanceKm: 7,  targetPaceMinPerKm: PACE_ZONES.tempo,    description: '28 min tempo' },
    ]
  },
  {
    week: 8, phase: 'Half Marathon Build', isCutback: true,
    sessions: [
      { id: '8-wed', day: 'wed', type: 'interval', targetDistanceKm: 5,  targetPaceMinPerKm: PACE_ZONES.interval, description: '5×400m @ interval pace' },
      { id: '8-sat', day: 'sat', type: 'long',     targetDistanceKm: 13, targetPaceMinPerKm: PACE_ZONES.long,     description: '13 km long' },
      { id: '8-sun', day: 'sun', type: 'easy',     targetDistanceKm: 6,  targetPaceMinPerKm: PACE_ZONES.easy,     description: '6 km easy' },
    ]
  },
  {
    week: 9, phase: 'Half Marathon Build', isCutback: false,
    sessions: [
      { id: '9-wed', day: 'wed', type: 'interval', targetDistanceKm: 6,  targetPaceMinPerKm: PACE_ZONES.interval, description: '4×800m @ interval pace' },
      { id: '9-sat', day: 'sat', type: 'long',     targetDistanceKm: 18, targetPaceMinPerKm: PACE_ZONES.long,     description: '18 km long' },
      { id: '9-sun', day: 'sun', type: 'tempo',    targetDistanceKm: 7,  targetPaceMinPerKm: PACE_ZONES.tempo,    description: '30 min tempo' },
    ]
  },
  {
    week: 10, phase: 'Half Marathon Build', isCutback: false,
    sessions: [
      { id: '10-wed', day: 'wed', type: 'interval', targetDistanceKm: 6,  targetPaceMinPerKm: PACE_ZONES.interval, description: '6×400m @ interval pace' },
      { id: '10-sat', day: 'sat', type: 'long',     targetDistanceKm: 19, targetPaceMinPerKm: PACE_ZONES.long,     description: '19 km long' },
      { id: '10-sun', day: 'sun', type: 'tempo',    targetDistanceKm: 8,  targetPaceMinPerKm: PACE_ZONES.tempo,    description: '32 min tempo' },
    ]
  },
  {
    week: 11, phase: 'Half Marathon Build', isCutback: false,
    sessions: [
      { id: '11-wed', day: 'wed', type: 'interval', targetDistanceKm: 7,  targetPaceMinPerKm: PACE_ZONES.interval, description: '3×1200m @ interval pace' },
      { id: '11-sat', day: 'sat', type: 'long',     targetDistanceKm: 21, targetPaceMinPerKm: PACE_ZONES.long,     description: '21 km long' },
      { id: '11-sun', day: 'sun', type: 'tempo',    targetDistanceKm: 8,  targetPaceMinPerKm: PACE_ZONES.tempo,    description: '35 min tempo' },
    ]
  },
  {
    week: 12, phase: 'Half Marathon Build', isCutback: true,
    sessions: [
      { id: '12-wed', day: 'wed', type: 'interval', targetDistanceKm: 5,  targetPaceMinPerKm: PACE_ZONES.interval, description: '4×800m @ interval pace' },
      { id: '12-sat', day: 'sat', type: 'long',     targetDistanceKm: 15, targetPaceMinPerKm: PACE_ZONES.long,     description: '15 km long' },
      { id: '12-sun', day: 'sun', type: 'easy',     targetDistanceKm: 6,  targetPaceMinPerKm: PACE_ZONES.easy,     description: '6 km easy' },
    ]
  },
  {
    week: 13, phase: 'Half Marathon Build', isCutback: false,
    sessions: [
      { id: '13-wed', day: 'wed', type: 'interval', targetDistanceKm: 7,  targetPaceMinPerKm: PACE_ZONES.interval, description: '3×1200m @ interval pace' },
      { id: '13-sat', day: 'sat', type: 'long',     targetDistanceKm: 20, targetPaceMinPerKm: PACE_ZONES.long,     description: '20 km long' },
      { id: '13-sun', day: 'sun', type: 'tempo',    targetDistanceKm: 9,  targetPaceMinPerKm: PACE_ZONES.tempo,    description: '38 min tempo' },
    ]
  },
  {
    week: 14, phase: 'Half Marathon Build', isCutback: false,
    sessions: [
      { id: '14-wed', day: 'wed', type: 'interval', targetDistanceKm: 7,  targetPaceMinPerKm: PACE_ZONES.interval, description: '5×800m @ interval pace' },
      { id: '14-sat', day: 'sat', type: 'long',     targetDistanceKm: 21, targetPaceMinPerKm: PACE_ZONES.long,     description: '21 km long' },
      { id: '14-sun', day: 'sun', type: 'tempo',    targetDistanceKm: 9,  targetPaceMinPerKm: PACE_ZONES.tempo,    description: '40 min tempo' },
    ]
  },

  // ── Phase 3: Marathon Build (Weeks 15–18) ──────────────────────────────────
  {
    week: 15, phase: 'Marathon Build', isCutback: false,
    sessions: [
      { id: '15-wed', day: 'wed', type: 'interval', targetDistanceKm: 8,  targetPaceMinPerKm: PACE_ZONES.interval, description: '6×800m @ interval pace' },
      { id: '15-sat', day: 'sat', type: 'long',     targetDistanceKm: 21, targetPaceMinPerKm: PACE_ZONES.long,     description: '21 km long' },
      { id: '15-sun', day: 'sun', type: 'tempo',    targetDistanceKm: 9,  targetPaceMinPerKm: PACE_ZONES.tempo,    description: '40 min tempo' },
    ]
  },
  {
    week: 16, phase: 'Marathon Build', isCutback: true,
    sessions: [
      { id: '16-wed', day: 'wed', type: 'interval', targetDistanceKm: 5,  targetPaceMinPerKm: PACE_ZONES.interval, description: '5×400m @ interval pace' },
      { id: '16-sat', day: 'sat', type: 'long',     targetDistanceKm: 16, targetPaceMinPerKm: PACE_ZONES.long,     description: '16 km long' },
      { id: '16-sun', day: 'sun', type: 'easy',     targetDistanceKm: 6,  targetPaceMinPerKm: PACE_ZONES.easy,     description: '6 km easy' },
    ]
  },
  {
    week: 17, phase: 'Marathon Build', isCutback: false,
    sessions: [
      { id: '17-wed', day: 'wed', type: 'interval', targetDistanceKm: 7,  targetPaceMinPerKm: PACE_ZONES.interval, description: '4×800m @ interval pace' },
      { id: '17-sat', day: 'sat', type: 'long',     targetDistanceKm: 21, targetPaceMinPerKm: PACE_ZONES.long,     description: '21 km long' },
      { id: '17-sun', day: 'sun', type: 'tempo',    targetDistanceKm: 9,  targetPaceMinPerKm: PACE_ZONES.tempo,    description: '45 min tempo' },
    ]
  },
  {
    week: 18, phase: 'Marathon Build', isCutback: true,
    sessions: [
      { id: '18-wed', day: 'wed', type: 'interval', targetDistanceKm: 4,  targetPaceMinPerKm: PACE_ZONES.interval, description: '3×400m @ interval pace' },
      { id: '18-sat', day: 'sat', type: 'long',     targetDistanceKm: 12, targetPaceMinPerKm: PACE_ZONES.long,     description: '12 km long' },
      { id: '18-sun', day: 'sun', type: 'easy',     targetDistanceKm: 10, targetPaceMinPerKm: PACE_ZONES.easy,     description: '10 km easy' },
    ]
  },
]

export function buildTrainingPlan(settings: UserSettings): TrainingWeek[] {
  // Backwards compatible: fall back to the legacy hardcoded plan unless the new
  // generator inputs are present.
  if (!settings.experienceLevel || !settings.trainingDays) {
    const pm = getSessionPaces(settings.currentVdot, settings);

    return trainingPlan.map(week => ({
      ...week,
      sessions: week.sessions.map(session => ({
        ...session,
        targetPaceMinPerKm:
          session.type === 'easy'     ? pm.easy.asSecondsPerKm / 60 :
          session.type === 'long'     ? pm.long.asSecondsPerKm / 60 :
          session.type === 'tempo'    ? pm.tempo.asSecondsPerKm / 60 :
          session.type === 'interval' ? pm.interval.asSecondsPerKm / 60 :
          session.targetPaceMinPerKm,
      })),
    }));
  }

  const days = (() => {
    try {
      const parsed = JSON.parse(settings.trainingDays) as unknown;
      if (!Array.isArray(parsed)) return null;
      const valid = parsed.filter((d): d is Day =>
        d === "mon" || d === "tue" || d === "wed" || d === "thu" || d === "fri" || d === "sat" || d === "sun",
      );
      return valid.length > 0 ? (valid as Day[]) : null;
    } catch {
      return null;
    }
  })();

  const longRunDay = (() => {
    const value = settings.longRunDay;
    return value === "mon" || value === "tue" || value === "wed" || value === "thu" || value === "fri" || value === "sat" || value === "sun"
      ? value
      : undefined;
  })();

  // Best-effort config coercion; generator handles missing/incomplete assignment.
  const config: PlanConfig = {
    level: settings.experienceLevel,
    goal: 
      settings.goalRace === "5K" ? "5k" :
      settings.goalRace === "10K" ? "10k" :
      settings.goalRace === "FULL" ? "full" : "hm",
    weeks: (settings.planLengthWeeks ?? 16) as 8 | 12 | 16 | 20,
    days: days ?? ["wed", "sat", "sun"], // default fallback
    longRunDay,
    vdot: settings.currentVdot,
    paceAdjust: {
      easyPaceOffsetSec: settings.easyPaceOffsetSec,
      tempoPaceOffsetSec: settings.tempoPaceOffsetSec,
      intervalPaceOffsetSec: settings.intervalPaceOffsetSec,
      longPaceOffsetSec: settings.longPaceOffsetSec,
      runningExperience: settings.runningExperience,
    },
  };

  return generatePlan(config);
}
