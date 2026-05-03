import type { RunType } from "@/data/trainingPlan";

export type { RunType };

export interface RatingInput {
  distanceKm: number;
  avgPaceSecKm: number;
  avgHeartRate: number | null | undefined;
  temperatureC?: number | null;
  humidityPct?: number | null;
  runType: RunType;
  personalBestPaceSecKm?: number | null;
  athleteAgeYears?: number;
}

export interface RatingResult {
  total: number;      // 0–10
  pace: number;       // 0–2.5
  effort: number;     // 0–2.5
  distance: number;   // 0–2.5
  conditions: number; // 0–2.5
}

// Target distance by run type (km)
const TARGET_DIST: Record<RunType, number> = {
  easy: 7,
  tempo: 10,
  interval: 8,
  long: 18,
};

// Ideal HR zone as fraction of max HR [low, high]
const HR_ZONE: Record<RunType, [number, number]> = {
  easy:     [0.60, 0.75],
  tempo:    [0.78, 0.88],
  interval: [0.88, 0.96],
  long:     [0.62, 0.78],
};

// Target pace by run type (sec/km)
const TARGET_PACE: Record<RunType, number> = {
  easy:     390, // 6:30/km
  tempo:    348, // 5:48/km
  interval: 300, // 5:00/km
  long:     420, // 7:00/km
};

export function calculateRunRating(input: RatingInput): RatingResult {
  const {
    distanceKm,
    avgPaceSecKm,
    avgHeartRate,
    temperatureC,
    humidityPct,
    runType,
    personalBestPaceSecKm,
    athleteAgeYears,
  } = input;

  // ── Pace (2.5 pts) ───────────────────────────────────────────────────────
  // 60% vs target pace, 40% vs personal best pace
  // Full score within ±30 sec/km (0.5 min/km) of target
  const targetPace = TARGET_PACE[runType];
  const pbPace = personalBestPaceSecKm ?? targetPace;

  const diffTarget = avgPaceSecKm - targetPace; // positive = slower
  const diffPB = avgPaceSecKm - pbPace;

  const targetScore = Math.max(0, Math.min(1, 1 - diffTarget / 30));
  const pbScore = diffPB <= 0 ? 1 : Math.max(0, 1 - diffPB / 60);

  const pace = (0.6 * targetScore + 0.4 * pbScore) * 2.5;

  // ── Effort / HR (2.5 pts) ────────────────────────────────────────────────
  let effort = 1.25; // neutral when no HR data
  if (avgHeartRate) {
    const age = athleteAgeYears ?? 23;
    const maxHR = 220 - age;
    const hrFrac = avgHeartRate / maxHR;
    const [zLow, zHigh] = HR_ZONE[runType];
    const zMid = (zLow + zHigh) / 2;
    const zHalf = (zHigh - zLow) / 2;
    const hrScore = Math.max(0, Math.min(1, 1 - Math.abs(hrFrac - zMid) / zHalf));
    effort = hrScore * 2.5;
  }

  // ── Distance (2.5 pts) ───────────────────────────────────────────────────
  // Scales against type target. Bonus up to 20% for exceeding.
  const targetDist = TARGET_DIST[runType];
  let ratio = distanceKm / targetDist;
  if (ratio > 1) ratio = 1 + Math.min(0.2, (ratio - 1) * 0.2);
  const distance = Math.min(2.5, (ratio / 1.2) * 2.5);

  // ── Conditions (2.5 pts) ─────────────────────────────────────────────────
  // Full 2.5 pts below 22°C apparent temp, scales to 0.8 at 38°C+
  let conditions = 1.5; // neutral when no weather data
  if (temperatureC !== null && temperatureC !== undefined) {
    let apparent = temperatureC;
    if (humidityPct !== null && humidityPct !== undefined && humidityPct > 40) {
      apparent += (humidityPct - 40) * 0.1;
    }
    if (apparent <= 22) {
      conditions = 2.5;
    } else if (apparent >= 38) {
      conditions = 0.8;
    } else {
      conditions = 2.5 - ((apparent - 22) / 16) * (2.5 - 0.8);
    }
  }

  const total = Math.max(0, Math.min(10, pace + effort + distance + conditions));

  return {
    total:      round1(total),
    pace:       round1(pace),
    effort:     round1(effort),
    distance:   round1(distance),
    conditions: round1(conditions),
  };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
