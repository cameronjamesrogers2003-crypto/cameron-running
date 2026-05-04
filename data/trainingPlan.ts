import { getVdotPaces } from "@/lib/vdot";
import type { UserSettings } from "@/lib/settings";

export type RunType = 'easy' | 'tempo' | 'interval' | 'long'
export type Day = 'wed' | 'sat' | 'sun'
export type Phase = 'Base' | 'Half Marathon Build' | 'Marathon Build' | 'Recovery'

export interface Session {
  day: Day
  type: RunType
  targetDistanceKm: number
  targetPaceMinPerKm: number
  description: string
}

export interface TrainingWeek {
  week: number
  phase: Phase
  isCutback: boolean
  isRecovery?: boolean
  originalWeek?: number
  sessions: Session[]
}

// Pace zones based on VDOT ~33 — reassess every 6–8 weeks
// Update PACE_ZONES when fitness improves
export const PACE_ZONES = {
  easy: 6.75,       // midpoint of 6:30–7:15
  long: 6.75,       // same as easy
  tempo: 5.42,      // midpoint of 5:15–5:35
  interval: 4.92,   // midpoint of 4:45–5:05
}

export const trainingPlan: TrainingWeek[] = [
  // ── Phase 1: Base (Weeks 1–6) ──────────────────────────────────────────────
  {
    week: 1, phase: 'Base', isCutback: false,
    sessions: [
      { day: 'wed', type: 'interval', targetDistanceKm: 4,  targetPaceMinPerKm: PACE_ZONES.interval, description: '4×400m @ interval pace' },
      { day: 'sat', type: 'long',     targetDistanceKm: 10, targetPaceMinPerKm: PACE_ZONES.long,     description: '10 km long' },
      { day: 'sun', type: 'easy',     targetDistanceKm: 6,  targetPaceMinPerKm: PACE_ZONES.easy,     description: '6 km easy' },
    ]
  },
  {
    week: 2, phase: 'Base', isCutback: false,
    sessions: [
      { day: 'wed', type: 'easy',     targetDistanceKm: 5,  targetPaceMinPerKm: PACE_ZONES.easy,     description: '5 km easy' },
      { day: 'sat', type: 'long',     targetDistanceKm: 12, targetPaceMinPerKm: PACE_ZONES.long,     description: '12 km long' },
      { day: 'sun', type: 'easy',     targetDistanceKm: 6,  targetPaceMinPerKm: PACE_ZONES.easy,     description: '6 km easy' },
    ]
  },
  {
    week: 3, phase: 'Base', isCutback: false,
    sessions: [
      { day: 'wed', type: 'interval', targetDistanceKm: 5,  targetPaceMinPerKm: PACE_ZONES.interval, description: '5×400m @ interval pace' },
      { day: 'sat', type: 'long',     targetDistanceKm: 13, targetPaceMinPerKm: PACE_ZONES.long,     description: '13 km long' },
      { day: 'sun', type: 'tempo',    targetDistanceKm: 6,  targetPaceMinPerKm: PACE_ZONES.tempo,    description: '20 min tempo' },
    ]
  },
  {
    week: 4, phase: 'Base', isCutback: true,
    sessions: [
      { day: 'wed', type: 'easy',     targetDistanceKm: 5,  targetPaceMinPerKm: PACE_ZONES.easy,     description: '5 km easy' },
      { day: 'sat', type: 'long',     targetDistanceKm: 10, targetPaceMinPerKm: PACE_ZONES.long,     description: '10 km long' },
      { day: 'sun', type: 'easy',     targetDistanceKm: 6,  targetPaceMinPerKm: PACE_ZONES.easy,     description: '6 km easy' },
    ]
  },
  {
    week: 5, phase: 'Base', isCutback: false,
    sessions: [
      { day: 'wed', type: 'interval', targetDistanceKm: 5,  targetPaceMinPerKm: PACE_ZONES.interval, description: '5×400m @ interval pace' },
      { day: 'sat', type: 'long',     targetDistanceKm: 14, targetPaceMinPerKm: PACE_ZONES.long,     description: '14 km long' },
      { day: 'sun', type: 'tempo',    targetDistanceKm: 6,  targetPaceMinPerKm: PACE_ZONES.tempo,    description: '22 min tempo' },
    ]
  },
  {
    week: 6, phase: 'Base', isCutback: false,
    sessions: [
      { day: 'wed', type: 'interval', targetDistanceKm: 6,  targetPaceMinPerKm: PACE_ZONES.interval, description: '4×800m @ interval pace' },
      { day: 'sat', type: 'long',     targetDistanceKm: 16, targetPaceMinPerKm: PACE_ZONES.long,     description: '16 km long' },
      { day: 'sun', type: 'tempo',    targetDistanceKm: 7,  targetPaceMinPerKm: PACE_ZONES.tempo,    description: '25 min tempo' },
    ]
  },

  // ── Phase 2: Half Marathon Build (Weeks 7–14) ──────────────────────────────
  {
    week: 7, phase: 'Half Marathon Build', isCutback: false,
    sessions: [
      { day: 'wed', type: 'interval', targetDistanceKm: 6,  targetPaceMinPerKm: PACE_ZONES.interval, description: '4×800m @ interval pace' },
      { day: 'sat', type: 'long',     targetDistanceKm: 17, targetPaceMinPerKm: PACE_ZONES.long,     description: '17 km long' },
      { day: 'sun', type: 'tempo',    targetDistanceKm: 7,  targetPaceMinPerKm: PACE_ZONES.tempo,    description: '28 min tempo' },
    ]
  },
  {
    week: 8, phase: 'Half Marathon Build', isCutback: true,
    sessions: [
      { day: 'wed', type: 'interval', targetDistanceKm: 5,  targetPaceMinPerKm: PACE_ZONES.interval, description: '5×400m @ interval pace' },
      { day: 'sat', type: 'long',     targetDistanceKm: 13, targetPaceMinPerKm: PACE_ZONES.long,     description: '13 km long' },
      { day: 'sun', type: 'easy',     targetDistanceKm: 6,  targetPaceMinPerKm: PACE_ZONES.easy,     description: '6 km easy' },
    ]
  },
  {
    week: 9, phase: 'Half Marathon Build', isCutback: false,
    sessions: [
      { day: 'wed', type: 'interval', targetDistanceKm: 6,  targetPaceMinPerKm: PACE_ZONES.interval, description: '4×800m @ interval pace' },
      { day: 'sat', type: 'long',     targetDistanceKm: 18, targetPaceMinPerKm: PACE_ZONES.long,     description: '18 km long' },
      { day: 'sun', type: 'tempo',    targetDistanceKm: 7,  targetPaceMinPerKm: PACE_ZONES.tempo,    description: '30 min tempo' },
    ]
  },
  {
    week: 10, phase: 'Half Marathon Build', isCutback: false,
    sessions: [
      { day: 'wed', type: 'interval', targetDistanceKm: 6,  targetPaceMinPerKm: PACE_ZONES.interval, description: '6×400m @ interval pace' },
      { day: 'sat', type: 'long',     targetDistanceKm: 19, targetPaceMinPerKm: PACE_ZONES.long,     description: '19 km long' },
      { day: 'sun', type: 'tempo',    targetDistanceKm: 8,  targetPaceMinPerKm: PACE_ZONES.tempo,    description: '32 min tempo' },
    ]
  },
  {
    week: 11, phase: 'Half Marathon Build', isCutback: false,
    sessions: [
      { day: 'wed', type: 'interval', targetDistanceKm: 7,  targetPaceMinPerKm: PACE_ZONES.interval, description: '3×1200m @ interval pace' },
      { day: 'sat', type: 'long',     targetDistanceKm: 21, targetPaceMinPerKm: PACE_ZONES.long,     description: '21 km long' },
      { day: 'sun', type: 'tempo',    targetDistanceKm: 8,  targetPaceMinPerKm: PACE_ZONES.tempo,    description: '35 min tempo' },
    ]
  },
  {
    week: 12, phase: 'Half Marathon Build', isCutback: true,
    sessions: [
      { day: 'wed', type: 'interval', targetDistanceKm: 5,  targetPaceMinPerKm: PACE_ZONES.interval, description: '4×800m @ interval pace' },
      { day: 'sat', type: 'long',     targetDistanceKm: 15, targetPaceMinPerKm: PACE_ZONES.long,     description: '15 km long' },
      { day: 'sun', type: 'easy',     targetDistanceKm: 6,  targetPaceMinPerKm: PACE_ZONES.easy,     description: '6 km easy' },
    ]
  },
  {
    week: 13, phase: 'Half Marathon Build', isCutback: false,
    sessions: [
      { day: 'wed', type: 'interval', targetDistanceKm: 7,  targetPaceMinPerKm: PACE_ZONES.interval, description: '3×1200m @ interval pace' },
      { day: 'sat', type: 'long',     targetDistanceKm: 20, targetPaceMinPerKm: PACE_ZONES.long,     description: '20 km long' },
      { day: 'sun', type: 'tempo',    targetDistanceKm: 9,  targetPaceMinPerKm: PACE_ZONES.tempo,    description: '38 min tempo' },
    ]
  },
  {
    week: 14, phase: 'Half Marathon Build', isCutback: false,
    sessions: [
      { day: 'wed', type: 'interval', targetDistanceKm: 7,  targetPaceMinPerKm: PACE_ZONES.interval, description: '5×800m @ interval pace' },
      { day: 'sat', type: 'long',     targetDistanceKm: 21, targetPaceMinPerKm: PACE_ZONES.long,     description: '21 km long' },
      { day: 'sun', type: 'tempo',    targetDistanceKm: 9,  targetPaceMinPerKm: PACE_ZONES.tempo,    description: '40 min tempo' },
    ]
  },

  // ── Phase 3: Marathon Build (Weeks 15–18) ──────────────────────────────────
  {
    week: 15, phase: 'Marathon Build', isCutback: false,
    sessions: [
      { day: 'wed', type: 'interval', targetDistanceKm: 8,  targetPaceMinPerKm: PACE_ZONES.interval, description: '6×800m @ interval pace' },
      { day: 'sat', type: 'long',     targetDistanceKm: 21, targetPaceMinPerKm: PACE_ZONES.long,     description: '21 km long' },
      { day: 'sun', type: 'tempo',    targetDistanceKm: 9,  targetPaceMinPerKm: PACE_ZONES.tempo,    description: '40 min tempo' },
    ]
  },
  {
    week: 16, phase: 'Marathon Build', isCutback: true,
    sessions: [
      { day: 'wed', type: 'interval', targetDistanceKm: 5,  targetPaceMinPerKm: PACE_ZONES.interval, description: '5×400m @ interval pace' },
      { day: 'sat', type: 'long',     targetDistanceKm: 16, targetPaceMinPerKm: PACE_ZONES.long,     description: '16 km long' },
      { day: 'sun', type: 'easy',     targetDistanceKm: 6,  targetPaceMinPerKm: PACE_ZONES.easy,     description: '6 km easy' },
    ]
  },
  {
    week: 17, phase: 'Marathon Build', isCutback: false,
    sessions: [
      { day: 'wed', type: 'interval', targetDistanceKm: 7,  targetPaceMinPerKm: PACE_ZONES.interval, description: '4×800m @ interval pace' },
      { day: 'sat', type: 'long',     targetDistanceKm: 21, targetPaceMinPerKm: PACE_ZONES.long,     description: '21 km long' },
      { day: 'sun', type: 'tempo',    targetDistanceKm: 9,  targetPaceMinPerKm: PACE_ZONES.tempo,    description: '45 min tempo' },
    ]
  },
  {
    week: 18, phase: 'Marathon Build', isCutback: true,
    sessions: [
      { day: 'wed', type: 'interval', targetDistanceKm: 4,  targetPaceMinPerKm: PACE_ZONES.interval, description: '3×400m @ interval pace' },
      { day: 'sat', type: 'long',     targetDistanceKm: 12, targetPaceMinPerKm: PACE_ZONES.long,     description: '12 km long' },
      { day: 'sun', type: 'easy',     targetDistanceKm: 10, targetPaceMinPerKm: PACE_ZONES.easy,     description: '10 km easy' },
    ]
  },
]

export function buildTrainingPlan(settings: UserSettings): TrainingWeek[] {
  const paces = getVdotPaces(settings.currentVdot);
  const easyPace     = paces.easyMaxSecKm  / 60;
  const tempoPace    = paces.tempoSecKm    / 60;
  const intervalPace = paces.intervalSecKm / 60;

  return trainingPlan.map(week => ({
    ...week,
    sessions: week.sessions.map(session => ({
      ...session,
      targetPaceMinPerKm:
        session.type === 'easy'     ? easyPace :
        session.type === 'long'     ? easyPace :
        session.type === 'tempo'    ? tempoPace :
        session.type === 'interval' ? intervalPace :
        session.targetPaceMinPerKm,
    })),
  }));
}
