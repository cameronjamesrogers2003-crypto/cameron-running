/**
 * Generates training-plan-matrix.csv (400 configs + header).
 * Logic matches spec: PEAK_KM @ 3 sessions/wk × SESSION_SCALE, phase floors + remainder→Base, cutback rules.
 */

const LEVELS = ["NOVICE", "BEGINNER", "INTERMEDIATE", "ADVANCED", "ELITE"];
const GOALS = ["5K", "10K", "HalfMarathon", "Marathon"];
const DURATIONS = [8, 12, 16, 20];
const SESSIONS = [2, 3, 4, 5, 6];

const PEAK_KM_3X = {
  "5K": { NOVICE: 15, BEGINNER: 25, INTERMEDIATE: 45, ADVANCED: 65, ELITE: 85 },
  "10K": { NOVICE: 20, BEGINNER: 35, INTERMEDIATE: 55, ADVANCED: 80, ELITE: 105 },
  HalfMarathon: { NOVICE: 35, BEGINNER: 50, INTERMEDIATE: 70, ADVANCED: 95, ELITE: 125 },
  Marathon: { NOVICE: 45, BEGINNER: 65, INTERMEDIATE: 90, ADVANCED: 130, ELITE: 170 },
};

const SESSION_SCALE = { 2: 0.74, 3: 1.0, 4: 1.24, 5: 1.46, 6: 1.67 };

function isShort(goal) {
  return goal === "5K" || goal === "10K";
}

function isNoviceBeginner(level) {
  return level === "NOVICE" || level === "BEGINNER";
}

function cutbackRule(level) {
  switch (level) {
    case "NOVICE":
      return "every 3 @ 25%";
    case "BEGINNER":
      return "every 4 @ 20%";
    case "INTERMEDIATE":
      return "every 4 @ 15%";
    case "ADVANCED":
    case "ELITE":
      return "every 5 @ 10%";
    default:
      return "every 4 @ 15%";
  }
}

function phaseWeeks(goal, level, totalWeeks) {
  const short = isShort(goal);
  const hm = !short;
  const nb = isNoviceBeginner(level);

  const taperWks = short ? 1 : 2;
  const rest = totalWeeks - taperWks;

  let pBase = 0.6;
  let pBuild = 0.2;
  let pPeak = 0.1;
  if (short && !nb) {
    pBase = 0.4;
    pBuild = 0.4;
    pPeak = 0.1;
  }
  if (hm && nb) {
    pBase = 0.5;
    pBuild = 0.3;
    pPeak = 0.1;
  }
  if (hm && !nb) {
    pBase = 0.3;
    pBuild = 0.4;
    pPeak = 0.2;
  }

  let baseW = Math.floor(rest * pBase);
  const buildW = Math.floor(rest * pBuild);
  const peakW = Math.floor(rest * pPeak);
  const assigned = baseW + buildW + peakW;
  const remainder = rest - assigned;
  baseW += remainder;

  return {
    baseW,
    buildW,
    peakW,
    taperWks,
  };
}

function round1(n) {
  return Math.round(n * 10) / 10;
}

function escapeCsvCell(s) {
  const str = String(s);
  if (/[",\n\r]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

const rows = [];
rows.push(
  [
    "Level",
    "Distance",
    "DurationWeeks",
    "SessionsPerWeek",
    "PeakKm",
    "BaseWeeks",
    "BuildWeeks",
    "PeakWeeks",
    "TaperWeeks",
    "CutbackRule",
  ].join(","),
);

for (const level of LEVELS) {
  for (const goal of GOALS) {
    for (const duration of DURATIONS) {
      for (const sessions of SESSIONS) {
        const basePeak = PEAK_KM_3X[goal][level];
        const peakKm = round1(basePeak * SESSION_SCALE[sessions]);
        const { baseW, buildW, peakW, taperWks } = phaseWeeks(goal, level, duration);
        const cutback = cutbackRule(level);
        rows.push(
          [
            escapeCsvCell(level),
            escapeCsvCell(goal),
            duration,
            sessions,
            peakKm,
            baseW,
            buildW,
            peakW,
            taperWks,
            escapeCsvCell(cutback),
          ].join(","),
        );
      }
    }
  }
}

const csv = rows.join("\n") + "\n";
if (rows.length !== 401) {
  console.error("Expected 401 lines (1 header + 400 data), got", rows.length);
  process.exit(1);
}

import { writeFileSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outPath = join(__dirname, "..", "data", "training-plan-matrix.csv");
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, csv, "utf8");
console.log("Wrote", outPath, "lines:", rows.length);
