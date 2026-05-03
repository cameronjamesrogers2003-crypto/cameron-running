function cToF(c: number): number {
  return c * 9 / 5 + 32;
}

// Stull (2011) apparent temperature proxy: temp_f + dewpoint_f
export function computeHeatSum(tempC: number, dewPointC: number): number {
  return cToF(tempC) + cToF(dewPointC);
}

// Piecewise linear slowdown fraction (0 = no correction, 0.06 = 6% max).
// Calibrated from Vihma (2010) heat stress running performance data.
export function getPaceSlowdownFraction(heatSum: number): number {
  if (heatSum < 100) return 0;

  const knots: [number, number][] = [
    [100, 0.000],
    [110, 0.005],
    [120, 0.010],
    [130, 0.020],
    [140, 0.030],
    [150, 0.045],
    [160, 0.060],
  ];

  if (heatSum >= 160) return 0.060 + (heatSum - 160) * 0.001;

  for (let i = 1; i < knots.length; i++) {
    const [x0, y0] = knots[i - 1];
    const [x1, y1] = knots[i];
    if (heatSum <= x1) {
      return y0 + ((heatSum - x0) / (x1 - x0)) * (y1 - y0);
    }
  }
  return 0;
}

export interface HeatCorrection {
  slowdownFraction: number;
  raisedDecouplingThreshold: boolean;
  heatSum: number;
  applied: boolean;
}

export function computeHeatCorrection(
  tempC: number | null,
  dewPointC: number | null
): HeatCorrection {
  if (tempC === null || dewPointC === null) {
    return { slowdownFraction: 0, raisedDecouplingThreshold: false, heatSum: 0, applied: false };
  }
  const heatSum = computeHeatSum(tempC, dewPointC);
  return {
    slowdownFraction: getPaceSlowdownFraction(heatSum),
    raisedDecouplingThreshold: dewPointC > 20,
    heatSum,
    applied: heatSum >= 110,
  };
}

// Widens the upper pace bound to credit heat-slowed running
export function applyHeatToPaceBand(
  lowSecKm: number,
  highSecKm: number,
  correction: HeatCorrection
): { low: number; high: number } {
  if (!correction.applied) return { low: lowSecKm, high: highSecKm };
  const mid = (lowSecKm + highSecKm) / 2;
  return { low: lowSecKm, high: highSecKm + mid * correction.slowdownFraction };
}
