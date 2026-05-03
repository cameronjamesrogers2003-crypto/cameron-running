import {
  scoreDistance, scorePace, scoreHR, scoreExecution, computeFinalScore,
  type SessionType,
} from "./components";
import { computeHeatCorrection, applyHeatToPaceBand } from "./heat";
import { computeNGP, computeRTSS, computeIntensityFactor, getPaceTargets, ALGORITHM_VERSION } from "./rTSS";

export { type SessionType } from "./components";
export { ALGORITHM_VERSION } from "./rTSS";

export interface StravaSplitInput {
  distance: number;
  movingTime: number;
  avgSpeed: number;
  gradeAdjSpeed?: number;
  avgHR?: number;
}

export interface ScoreInput {
  activityId: string;
  sessionType: SessionType;
  plannedKm: number;
  actualKm: number;
  durationSecs: number;
  elapsedSecs: number;
  avgPaceSecKm: number;
  avgHR: number | null;
  maxHR: number | null;
  elevationGainM: number | null;
  splits: StravaSplitInput[] | null;
  targetPaceLowSecKm: number | null;
  targetPaceHighSecKm: number | null;
  targetHrZone: number | null;
  ageYears: number;
  rftpSecKm: number | null;
  hrMax: number | null;
  weatherTempC: number | null;
  weatherDewPointC: number | null;
  recentTSS: { date: Date; tss: number }[];
  recent4wkAvgScore: number | null;
}

export interface ScoreResult {
  score: number;
  distanceScore: number;
  paceScore: number;
  hrScore: number | null;
  executionScore: number;
  rTSS: number | null;
  intensityFactor: number | null;
  decouplingPct: number | null;
  gapSecKm: number | null;
  weatherTempC: number | null;
  weatherDewPointC: number | null;
  heatAdjusted: boolean;
  algorithmVersion: string;
  commentaryContext: CommentaryContext;
}

export interface CommentaryContext {
  sessionType: SessionType;
  plannedKm: number;
  actualKm: number;
  adjustedPaceLow: number | null;
  adjustedPaceHigh: number | null;
  actualGapSecKm: number | null;
  targetHrZone: number;
  pctTimeInZone: number;
  decouplingPct: number | null;
  weatherTempC: number | null;
  weatherDewPointC: number | null;
  subScores: { distance: number; pace: number; hr: number | null; execution: number };
  finalScore: number;
  recent4wkAvgScore: number | null;
  heatAdjusted: boolean;
}

// Aerobic decoupling: positive value = cardiac drift (first half more efficient than second)
function computeDecoupling(splits: StravaSplitInput[]): number | null {
  const withHR = splits.filter(s => s.avgHR && s.avgHR > 0);
  if (withHR.length < 4) return null;

  const mid = Math.floor(withHR.length / 2);
  const avgEF = (half: StravaSplitInput[]) => {
    const totalDist = half.reduce((s, x) => s + x.distance, 0);
    if (!totalDist) return 0;
    const avgSpd = half.reduce((s, x) => s + x.avgSpeed * x.distance, 0) / totalDist;
    const avgHR = half.reduce((s, x) => s + x.avgHR! * x.distance, 0) / totalDist;
    return avgHR > 0 ? avgSpd / avgHR : 0;
  };

  const ef1 = avgEF(withHR.slice(0, mid));
  const ef2 = avgEF(withHR.slice(mid));
  if (!ef1 || !ef2) return null;
  return ((ef1 / ef2) - 1) * 100;
}

function computePctTimeInZone(
  splits: StravaSplitInput[],
  hrZone: number,
  hrMax: number
): number {
  const bounds: Record<number, [number, number]> = {
    1: [0.50, 0.60], 2: [0.60, 0.70], 3: [0.70, 0.80],
    4: [0.80, 0.90], 5: [0.90, 1.00],
  };
  const [lo, hi] = (bounds[hrZone] ?? bounds[2]).map(f => f * hrMax);

  let total = 0, inZone = 0;
  for (const s of splits) {
    if (!s.avgHR || !s.movingTime) continue;
    total += s.movingTime;
    if (s.avgHR >= lo && s.avgHR <= hi) inZone += s.movingTime;
  }
  return total > 0 ? (inZone / total) * 100 : 0;
}

// Pure orchestrator — no I/O. All data is passed in.
export function computeRunRating(input: ScoreInput): ScoreResult {
  const effectiveHrMax = input.hrMax ?? (220 - input.ageYears);
  const lthr = effectiveHrMax * 0.89;
  // Beginner default rFTP: derive from current average easy pace if not set
  const effectiveRFTP = input.rftpSecKm
    ?? (input.avgPaceSecKm > 0 ? Math.round(input.avgPaceSecKm * 0.88) : 360);

  const heat = computeHeatCorrection(input.weatherTempC, input.weatherDewPointC);

  let { targetPaceLowSecKm, targetPaceHighSecKm } = input;
  if (!targetPaceLowSecKm || !targetPaceHighSecKm) {
    const t = getPaceTargets(effectiveRFTP, input.sessionType);
    targetPaceLowSecKm = t?.low ?? null;
    targetPaceHighSecKm = t?.high ?? null;
  }

  const band = targetPaceLowSecKm && targetPaceHighSecKm
    ? applyHeatToPaceBand(targetPaceLowSecKm, targetPaceHighSecKm, heat)
    : null;

  const gapSecKm = input.splits
    ? computeNGP(input.splits.map(s => ({
        avgSpeed: s.avgSpeed,
        gradeAdjSpeed: s.gradeAdjSpeed,
        distance: s.distance,
      })))
    : input.avgPaceSecKm || null;

  const decouplingPct = input.splits ? computeDecoupling(input.splits) : null;

  const targetZone = input.targetHrZone
    ?? ((input.sessionType === "TEMPO" || input.sessionType === "PACE") ? 3 : 2);

  const pctTimeInZone = input.splits
    ? computePctTimeInZone(input.splits, targetZone, effectiveHrMax)
    : (input.avgHR ? (input.avgHR > effectiveHrMax * 0.60 && input.avgHR < effectiveHrMax * 0.70 ? 70 : 40) : 0);

  const pausedPct = input.elapsedSecs > 0
    ? Math.max(0, (input.elapsedSecs - input.durationSecs) / input.elapsedSecs)
    : 0;

  const distScore = scoreDistance(input.actualKm, input.plannedKm, input.sessionType);
  const paceScore = band && gapSecKm
    ? scorePace(gapSecKm, band.low, band.high, input.sessionType)
    : 0.5;
  const hrScore = scoreHR(pctTimeInZone, decouplingPct, input.sessionType, input.avgHR, input.ageYears);
  const execScore = scoreExecution(
    pausedPct, decouplingPct, input.avgHR, lthr,
    input.sessionType, heat.raisedDecouplingThreshold
  );

  const finalScore = computeFinalScore(distScore, paceScore, hrScore, execScore);

  const rTSS = gapSecKm ? computeRTSS(input.durationSecs, gapSecKm, effectiveRFTP) : null;
  const intensityFactor = gapSecKm ? computeIntensityFactor(gapSecKm, effectiveRFTP) : null;

  return {
    score: finalScore,
    distanceScore: distScore,
    paceScore,
    hrScore,
    executionScore: execScore,
    rTSS,
    intensityFactor,
    decouplingPct,
    gapSecKm,
    weatherTempC: input.weatherTempC,
    weatherDewPointC: input.weatherDewPointC,
    heatAdjusted: heat.applied,
    algorithmVersion: ALGORITHM_VERSION,
    commentaryContext: {
      sessionType: input.sessionType,
      plannedKm: input.plannedKm,
      actualKm: input.actualKm,
      adjustedPaceLow: band?.low ?? null,
      adjustedPaceHigh: band?.high ?? null,
      actualGapSecKm: gapSecKm,
      targetHrZone: targetZone,
      pctTimeInZone,
      decouplingPct,
      weatherTempC: input.weatherTempC,
      weatherDewPointC: input.weatherDewPointC,
      subScores: { distance: distScore, pace: paceScore, hr: hrScore, execution: execScore },
      finalScore,
      recent4wkAvgScore: input.recent4wkAvgScore,
      heatAdjusted: heat.applied,
    },
  };
}
