"use client";

import { useEffect, useMemo, useState } from "react";
import { formatPace } from "@/lib/settings";
import {
  computeVdotFromRaceTimes,
  fitnessIdentityLabel,
  getVdotPaces,
  suggestedLevelFromVdot,
} from "@/lib/vdot";
import { getSliderBaseSecKm } from "@/lib/planPaces";
import {
  RUNNING_EXPERIENCE_1_3,
  RUNNING_EXPERIENCE_3_5,
  RUNNING_EXPERIENCE_5PLUS,
  RUNNING_EXPERIENCE_LT1,
} from "@/lib/planPaces";
import { FORM_CONTROL_TW } from "@/lib/formControlClasses";

export type VdotLevel = "BEGINNER" | "INTERMEDIATE" | "ADVANCED";

type RacePiece = { minutes: string; seconds: string };

export type VdotPersonalFields = {
  ageInput: string;
  gender: string;
  weightInput: string;
  runningExperience: string;
};

function emptyRace(): RacePiece {
  return { minutes: "", seconds: "" };
}

function raceForCompute(r: RacePiece): { minutes: number; seconds: number } | null {
  const minutes = parseInt(r.minutes, 10) || 0;
  if (minutes <= 0) return null;
  const seconds = Math.min(59, Math.max(0, parseInt(r.seconds, 10) || 0));
  return { minutes, seconds };
}

function levelDisplay(l: VdotLevel): string {
  if (l === "BEGINNER") return "Beginner";
  if (l === "INTERMEDIATE") return "Intermediate";
  return "Advanced";
}

function parsePersonal(
  personal: VdotPersonalFields,
): { age: number | null; gender: string | null; weightKg: number | null; runningExperience: string | null } {
  const ageParsed = personal.ageInput.trim() === "" ? null : Number(personal.ageInput);
  const age = ageParsed != null && Number.isFinite(ageParsed) ? Math.round(ageParsed) : null;
  const wParsed = personal.weightInput.trim() === "" ? null : Number(personal.weightInput);
  const weightKg = wParsed != null && Number.isFinite(wParsed) ? wParsed : null;
  return {
    age,
    gender: personal.gender || null,
    weightKg,
    runningExperience: personal.runningExperience || null,
  };
}

export default function VdotCalculator({
  onApply,
  onLevelSuggested,
  onFitnessSave,
  maxHR: maxHRControlled,
  onMaxHRChange,
  initialMaxHr = 198,
  personal: personalControlled,
  onPersonalChange,
  seedRaceDistance = null,
  seedRaceMinutes = null,
  seedRaceSeconds = null,
}: {
  onApply?: (vdot: number) => void;
  onLevelSuggested?: (level: VdotLevel) => void;
  onFitnessSave?: (payload: {
    vdot: number;
    maxHR: number;
    vdotRaceDistance: string;
    vdotRaceMinutes: number;
    vdotRaceSeconds: number;
    age: number | null;
    gender: string | null;
    weightKg: number | null;
    runningExperience: string | null;
  }) => void | Promise<void>;
  maxHR?: number;
  onMaxHRChange?: (n: number) => void;
  initialMaxHr?: number;
  personal?: VdotPersonalFields;
  onPersonalChange?: (p: VdotPersonalFields) => void;
  seedRaceDistance?: string | null;
  seedRaceMinutes?: number | null;
  seedRaceSeconds?: number | null;
}) {
  const [internalMaxHR, setInternalMaxHR] = useState(initialMaxHr);
  const maxHR = maxHRControlled ?? internalMaxHR;
  const setMaxHR = onMaxHRChange ?? setInternalMaxHR;
  const [maxHrInput, setMaxHrInput] = useState(String(maxHR));

  const [internalPersonal, setInternalPersonal] = useState<VdotPersonalFields>({
    ageInput: "",
    gender: "",
    weightInput: "",
    runningExperience: "",
  });
  const personal = personalControlled ?? internalPersonal;
  const setPersonal = (next: VdotPersonalFields) => {
    onPersonalChange?.(next);
    if (!personalControlled) setInternalPersonal(next);
  };

  const [fiveKm, setFiveKm] = useState<RacePiece>(emptyRace);
  const [tenKm, setTenKm] = useState<RacePiece>(emptyRace);
  const [half, setHalf] = useState<RacePiece>(emptyRace);

  const { age, gender, weightKg, runningExperience } = parsePersonal(personal);
  const parsedMaxHr = (() => {
    const n = parseInt(maxHrInput, 10) || 0;
    return n > 0 ? n : 0;
  })();

  /* eslint-disable react-hooks/set-state-in-effect -- hydrate race inputs from stored vdot race */
  useEffect(() => {
    const d = seedRaceDistance?.trim();
    const m = seedRaceMinutes;
    const s = seedRaceSeconds ?? 0;
    if (d == null || m == null) return;
    const piece: RacePiece = { minutes: String(m), seconds: String(s) };
    if (d === "5" || d === "5k" || d === "5K") setFiveKm(piece);
    else if (d === "10" || d === "10k" || d === "10K") setTenKm(piece);
    else if (d === "21.1" || d === "hm" || d === "HM") setHalf(piece);
  }, [seedRaceDistance, seedRaceMinutes, seedRaceSeconds]);
  /* eslint-enable react-hooks/set-state-in-effect */
  /* eslint-disable react-hooks/set-state-in-effect -- keep input in sync with source maxHR */
  useEffect(() => {
    setMaxHrInput(String(maxHR));
  }, [maxHR]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const result = useMemo(() => {
    const races = {
      fiveKm: raceForCompute(fiveKm),
      tenKm: raceForCompute(tenKm),
      half: raceForCompute(half),
    };
    return computeVdotFromRaceTimes(races, age, runningExperience);
  }, [fiveKm, tenKm, half, age, runningExperience]);

  const adjustedVdot = result?.adjustedVdot ?? null;
  const previewPaces = adjustedVdot != null ? getVdotPaces(adjustedVdot) : null;
  const longPreviewSec =
    previewPaces != null && adjustedVdot != null
      ? getSliderBaseSecKm("long", adjustedVdot, runningExperience)
      : null;
  const level = adjustedVdot != null ? suggestedLevelFromVdot(adjustedVdot) : null;

  const controlCls = `w-full px-4 py-2.5 rounded-xl text-sm bg-white/[0.06] border border-white/[0.10] text-white outline-none focus:border-teal-500/50 transition-colors ${FORM_CONTROL_TW}`;

  return (
    <div
      className="rounded-[10px] p-4 space-y-5"
      style={{ background: "#141414", border: "1px solid rgba(255,255,255,0.08)" }}
    >
      <div>
        <p className="text-xs uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>
          Personal details (optional)
        </p>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <label className="text-xs block space-y-1">
            <span style={{ color: "var(--text-muted)" }}>Age (years)</span>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={personal.ageInput}
              onChange={(e) => setPersonal({ ...personal, ageInput: e.target.value })}
              className={controlCls}
              placeholder="0"
            />
          </label>
          <label className="text-xs block space-y-1">
            <span style={{ color: "var(--text-muted)" }}>Gender</span>
            <select
              value={personal.gender}
              onChange={(e) => setPersonal({ ...personal, gender: e.target.value })}
              className={controlCls}
            >
              <option value="" className="text-gray-900 dark:text-white">
                —
              </option>
              <option value="Male" className="text-gray-900 dark:text-white">
                Male
              </option>
              <option value="Female" className="text-gray-900 dark:text-white">
                Female
              </option>
              <option value="Prefer not to say" className="text-gray-900 dark:text-white">
                Prefer not to say
              </option>
            </select>
          </label>
        </div>
        <label className="text-xs block space-y-1 mb-3">
            <span style={{ color: "var(--text-muted)" }}>Weight (kg)</span>
            <input
              type="text"
              inputMode="decimal"
              value={personal.weightInput}
              onChange={(e) => setPersonal({ ...personal, weightInput: e.target.value })}
              className={controlCls}
              placeholder="0"
            />
        </label>
        <label className="text-xs block space-y-1 mb-3">
            <span style={{ color: "var(--text-muted)" }}>Years of running experience</span>
            <select
              value={personal.runningExperience}
              onChange={(e) => setPersonal({ ...personal, runningExperience: e.target.value })}
              className={controlCls}
            >
              <option value="" className="text-gray-900 dark:text-white">
                —
              </option>
              <option value={RUNNING_EXPERIENCE_LT1} className="text-gray-900 dark:text-white">
                &lt; 1 year
              </option>
              <option value={RUNNING_EXPERIENCE_1_3} className="text-gray-900 dark:text-white">
                1–3 years
              </option>
              <option value={RUNNING_EXPERIENCE_3_5} className="text-gray-900 dark:text-white">
                3–5 years
              </option>
              <option value={RUNNING_EXPERIENCE_5PLUS} className="text-gray-900 dark:text-white">
                5+ years
              </option>
            </select>
        </label>
        <label className="text-xs block space-y-1 mb-4">
            <span style={{ color: "var(--text-muted)" }}>Max HR (bpm)</span>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={maxHrInput}
              onChange={(e) => {
                const next = e.target.value;
                setMaxHrInput(next);
                const n = parseInt(next, 10) || 0;
                if (n > 0) setMaxHR(n);
              }}
              onBlur={() => {
                if (maxHrInput.trim() === "") {
                  setMaxHrInput(String(maxHR));
                }
              }}
              className={controlCls}
              placeholder="0"
            />
        </label>
        {weightKg != null && (
          <p className="text-[11px] mt-2" style={{ color: "var(--text-muted)" }}>
            Weight is informational only — it does not change your VDOT.
          </p>
        )}
        {personal.gender ? (
          <p className="text-[11px] mt-1" style={{ color: "var(--text-muted)" }}>
            VDOT is gender-neutral — it measures fitness relative to your own performance.
          </p>
        ) : null}
      </div>

      <div>
        <p className="text-xs uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>
          Recent race times (at least one)
        </p>
        <p className="text-[11px] mb-3" style={{ color: "var(--text-muted)" }}>
          Enter minutes and seconds for any distance you have — leave blank otherwise.
        </p>
        {(
          [
            { label: "5K", state: fiveKm, set: setFiveKm },
            { label: "10K", state: tenKm, set: setTenKm },
            { label: "Half marathon", state: half, set: setHalf },
          ] as const
        ).map(({ label, state, set }) => (
          <div key={label}>
            <p className="text-sm font-semibold text-white mb-2">{label}</p>
            <div className="grid grid-cols-2 gap-2 mb-4">
              <div>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={state.minutes}
                  onChange={(e) => set({ ...state, minutes: e.target.value })}
                  className={`px-3 py-2.5 rounded-xl text-sm text-center font-mono bg-white/[0.06] border border-white/[0.10] text-white focus:border-teal-500/50 outline-none transition-colors ${FORM_CONTROL_TW}`}
                  placeholder="0"
                />
                <p className="text-xs text-center mt-1" style={{ color: "var(--text-dim)" }}>
                  min
                </p>
              </div>
              <div>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={state.seconds}
                  onChange={(e) => set({ ...state, seconds: e.target.value })}
                  className={`px-3 py-2.5 rounded-xl text-sm text-center font-mono bg-white/[0.06] border border-white/[0.10] text-white focus:border-teal-500/50 outline-none transition-colors ${FORM_CONTROL_TW}`}
                  placeholder="00"
                />
                <p className="text-xs text-center mt-1" style={{ color: "var(--text-dim)" }}>
                  sec
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {result && adjustedVdot != null && previewPaces && longPreviewSec != null && level && (
        <div
          className="rounded-2xl p-4 mt-4"
          style={{
            background: "linear-gradient(135deg, rgba(45,212,191,0.10) 0%, rgba(45,212,191,0.04) 100%)",
            border: "1px solid rgba(45,212,191,0.25)",
          }}
        >
          <p className="text-3xl font-black font-mono tabular-nums" style={{ color: "var(--accent)" }}>
            VDOT {adjustedVdot}
          </p>
          <p className="text-sm font-mono mt-1" style={{ color: "var(--text-muted)" }}>
            VO2max estimate: {result.displayVo2.toFixed(1)} ml/kg/min
          </p>
          <p className="text-base font-bold text-white mt-2">{fitnessIdentityLabel(adjustedVdot)}</p>
          <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
            Suggested level: {levelDisplay(level)}
          </p>
          <div className="grid grid-cols-2 gap-2 mt-3">
            <div>
              <p className="text-xs" style={{ color: "var(--text-dim)" }}>Easy</p>
              <p className="text-sm font-mono font-semibold text-white">
                {formatPace(previewPaces.easyMinSecKm)} – {formatPace(previewPaces.easyMaxSecKm)} /km
              </p>
            </div>
            <div>
              <p className="text-xs" style={{ color: "var(--text-dim)" }}>Tempo</p>
              <p className="text-sm font-mono font-semibold text-white">
                {formatPace(getSliderBaseSecKm("tempo", adjustedVdot, runningExperience))} /km
              </p>
            </div>
            <div>
              <p className="text-xs" style={{ color: "var(--text-dim)" }}>Interval</p>
              <p className="text-sm font-mono font-semibold text-white">
                {formatPace(getSliderBaseSecKm("interval", adjustedVdot, runningExperience))} /km
              </p>
            </div>
            <div>
              <p className="text-xs" style={{ color: "var(--text-dim)" }}>Long run</p>
              <p className="text-sm font-mono font-semibold text-white">{formatPace(longPreviewSec)} /km</p>
            </div>
          </div>
          <button
            type="button"
            className="w-full mt-4 py-2.5 rounded-xl text-sm font-semibold transition-all hover:bg-teal-400/20"
            style={{
              background: "rgba(45,212,191,0.15)",
              border: "1px solid rgba(45,212,191,0.35)",
              color: "var(--accent)",
            }}
            onClick={async () => {
              const r = computeVdotFromRaceTimes(
                {
                  fiveKm: raceForCompute(fiveKm),
                  tenKm: raceForCompute(tenKm),
                  half: raceForCompute(half),
                },
                age,
                runningExperience,
              );
              if (!r) return;
              const win = r.winningDistanceKey;
              const winTimes = win === "5" ? fiveKm : win === "10" ? tenKm : half;
              const winMinutes = parseInt(winTimes.minutes, 10) || 0;
              const winSeconds = Math.min(59, Math.max(0, parseInt(winTimes.seconds, 10) || 0));
              const parsed = parsePersonal(personal);
              const payload = {
                vdot: r.adjustedVdot,
                maxHR: parsedMaxHr > 0 ? parsedMaxHr : initialMaxHr,
                vdotRaceDistance: win,
                vdotRaceMinutes: winMinutes,
                vdotRaceSeconds: winSeconds,
                age: parsed.age,
                gender: parsed.gender,
                weightKg: parsed.weightKg,
                runningExperience: parsed.runningExperience,
              };
              await onFitnessSave?.(payload);
              onApply?.(r.adjustedVdot);
              onLevelSuggested?.(suggestedLevelFromVdot(r.adjustedVdot));
            }}
          >
            Apply
          </button>
        </div>
      )}
    </div>
  );
}
