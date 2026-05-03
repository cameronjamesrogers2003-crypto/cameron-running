export const ALGORITHM_VERSION = "1.0.0";

// Grade-adjusted pace from Strava splits (average_grade_adjusted_speed preferred)
export function computeNGP(
  splits: { avgSpeed: number; gradeAdjSpeed?: number; distance: number }[]
): number | null {
  if (!splits.length) return null;

  let totalDist = 0;
  let weightedSpeed = 0;

  for (const s of splits) {
    const speed = (s.gradeAdjSpeed && s.gradeAdjSpeed > 0) ? s.gradeAdjSpeed : s.avgSpeed;
    totalDist += s.distance;
    weightedSpeed += speed * s.distance;
  }

  if (totalDist === 0 || weightedSpeed === 0) return null;
  return Math.round(1000 / (weightedSpeed / totalDist)); // sec/km
}

// rTSS = (duration_sec × NGP_speed × IF) / (rFTP_speed × 3600) × 100
// Pace values in sec/km; speed = 1000 / pace
export function computeRTSS(
  durationSec: number,
  ngpSecKm: number,
  rftpSecKm: number
): number {
  if (rftpSecKm <= 0 || ngpSecKm <= 0 || durationSec <= 0) return 0;
  const ngpSpeed = 1000 / ngpSecKm;
  const rftpSpeed = 1000 / rftpSecKm;
  const IF = ngpSpeed / rftpSpeed;
  return Math.round((durationSec * ngpSpeed * IF) / (rftpSpeed * 3600) * 100 * 10) / 10;
}

export function computeIntensityFactor(ngpSecKm: number, rftpSecKm: number): number {
  if (rftpSecKm <= 0 || ngpSecKm <= 0) return 0;
  return (1000 / ngpSecKm) / (1000 / rftpSecKm);
}

// EWMA with exponential decay: τ is the characteristic time constant in days
export function updateEWMA(prev: number, newVal: number, tau: number): number {
  const lambda = 1 - Math.exp(-1 / tau);
  return prev * (1 - lambda) + newVal * lambda;
}

// ATL τ=7, CTL τ=42 as per Banister's impulse-response model
export function computeACWR(
  dailyTSS: { date: Date; tss: number }[]
): { atl: number; ctl: number; acwr: number } {
  let atl = 0;
  let ctl = 0;

  const sorted = [...dailyTSS].sort((a, b) => a.date.getTime() - b.date.getTime());
  for (const { tss } of sorted) {
    atl = updateEWMA(atl, tss, 7);
    ctl = updateEWMA(ctl, tss, 42);
  }

  const acwr = ctl > 0 ? atl / ctl : 1.0;
  return { atl, ctl, acwr };
}

// Derive target pace bands from rFTP (sec/km)
export function getPaceTargets(
  rftpSecKm: number,
  sessionType: string
): { low: number; high: number } | null {
  switch (sessionType) {
    case "EASY":
      return { low: rftpSecKm + 60, high: rftpSecKm + 90 };
    case "LONG":
    case "SORTA_LONG":
      return { low: rftpSecKm + 75, high: rftpSecKm + 120 };
    case "PACE":
    case "TEMPO":
      return { low: rftpSecKm + 15, high: rftpSecKm + 30 };
    case "INTERVALS":
      return { low: rftpSecKm - 30, high: rftpSecKm + 10 };
    default:
      return null;
  }
}

// Estimate rFTP from recent easy runs in the 20–40 min window.
// Prefers efforts near 88% HRmax (threshold effort equivalent).
export function estimateRFTP(
  recentEasy: { avgPaceSecKm: number; avgHR: number | null; durationSecs: number }[],
  hrMax: number
): number | null {
  const pool = recentEasy.filter(a => {
    const mins = a.durationSecs / 60;
    return mins >= 20 && mins <= 40 && a.avgPaceSecKm > 0;
  });
  if (!pool.length) return null;

  const threshold = hrMax * 0.88;
  const withHR = pool.filter(a => a.avgHR && Math.abs(a.avgHR - threshold) < 20);
  const candidates = withHR.length >= 2 ? withHR : pool;

  return candidates.reduce((best, a) =>
    a.avgPaceSecKm < best.avgPaceSecKm ? a : best
  ).avgPaceSecKm;
}
