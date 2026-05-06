"use client";

import { useMemo, useState } from "react";
import { getVdotPaces } from "@/lib/vdot";
import { formatPace } from "@/lib/settings";

type Level = "BEGINNER" | "INTERMEDIATE" | "ADVANCED";

const DISTANCES = [
  { key: "1", label: "1 km", metres: 1000 },
  { key: "1mile", label: "1 mile", metres: 1609.34 },
  { key: "5", label: "5 km", metres: 5000 },
  { key: "10", label: "10 km", metres: 10000 },
  { key: "21.1", label: "Half Marathon", metres: 21097.5 },
  { key: "42.2", label: "Marathon", metres: 42195 },
] as const;

export default function VdotCalculator({
  onApply,
  onApplyDetails,
  onLevelSuggested,
  initialDistance = "5",
  initialMinutes = 25,
  initialSeconds = 0,
}: {
  onApply?: (vdot: number) => void;
  onApplyDetails?: (payload: { vdot: number; level: Level; distance: string; minutes: number; seconds: number }) => void;
  onLevelSuggested?: (level: Level) => void;
  initialDistance?: string;
  initialMinutes?: number;
  initialSeconds?: number;
}) {
  const normalizedInitialDistance =
    initialDistance === "1k" ? "1"
    : initialDistance === "5k" ? "5"
    : initialDistance === "10k" ? "10"
    : initialDistance === "hm" ? "21.1"
    : initialDistance === "marathon" ? "42.2"
    : initialDistance;
  const defaultDistanceKey = DISTANCES.find((d) => d.key === normalizedInitialDistance)?.key ?? "5";
  const [distanceKey, setDistanceKey] = useState<(typeof DISTANCES)[number]["key"]>(defaultDistanceKey);
  const [minutes, setMinutes] = useState<number>(initialMinutes);
  const [seconds, setSeconds] = useState<number>(initialSeconds);

  const result = useMemo(() => {
    const d = DISTANCES.find((x) => x.key === distanceKey);
    if (!d) return null;
    if (minutes < 0 || seconds < 0 || seconds > 59) return null;
    const t = minutes + seconds / 60;
    if (t <= 0) return null;

    const velocity = d.metres / t;
    const pct =
      0.8
      + 0.1894393 * Math.exp(-0.012778 * t)
      + 0.2989558 * Math.exp(-0.1932605 * t);

    if (pct <= 0) return null;
    const vo2 = (-4.6 + 0.182258 * velocity + 0.000104 * velocity * velocity) / pct;
    if (!Number.isFinite(vo2) || vo2 <= 0) return null;

    const vdot = Math.max(1, Math.round(vo2));
    const paces = getVdotPaces(vdot);
    const level: Level = vdot < 35 ? "BEGINNER" : vdot < 50 ? "INTERMEDIATE" : "ADVANCED";

    return { vdot, vo2, paces, level };
  }, [distanceKey, minutes, seconds]);

  return (
    <div className="rounded-[10px] p-4 space-y-4" style={{ background: "#181818", border: "1px solid rgba(255,255,255,0.08)" }}>
      <div className="space-y-2">
        <label className="text-xs uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
          Distance
        </label>
        <select
          value={distanceKey}
          onChange={(e) => setDistanceKey(e.target.value as (typeof DISTANCES)[number]["key"])}
          className="w-full min-h-11 rounded-md px-3 py-2 bg-black/20 border border-white/10 text-white"
        >
          {DISTANCES.map((d) => (
            <option key={d.key} value={d.key}>
              {d.label}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <label className="text-xs uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
          Race Time
        </label>
        <div className="grid grid-cols-2 gap-2">
          <input
            type="number"
            min={0}
            value={minutes}
            onChange={(e) => setMinutes(Math.max(0, Number(e.target.value || 0)))}
            className="w-full min-h-11 rounded-md px-3 py-2 bg-black/20 border border-white/10 text-white"
            placeholder="Minutes"
          />
          <input
            type="number"
            min={0}
            max={59}
            value={seconds}
            onChange={(e) => setSeconds(Math.min(59, Math.max(0, Number(e.target.value || 0))))}
            className="w-full min-h-11 rounded-md px-3 py-2 bg-black/20 border border-white/10 text-white"
            placeholder="Seconds"
          />
        </div>
      </div>

      {result && (
        <div className="rounded-md p-3 space-y-2" style={{ background: "rgba(45,212,191,0.08)", border: "1px solid rgba(45,212,191,0.22)" }}>
          <p className="text-sm text-white font-semibold">VDOT: {result.vdot}</p>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            VO2max estimate: {result.vo2.toFixed(1)} ml/kg/min
          </p>
          <div className="text-xs space-y-1">
            <p>Easy: {formatPace(result.paces.easyMinSecKm)} – {formatPace(result.paces.easyMaxSecKm)} /km</p>
            <p>Tempo: {formatPace(result.paces.tempoSecKm)} /km</p>
            <p>Interval: {formatPace(result.paces.intervalSecKm)} /km</p>
            <p>Long run: ~10% slower than easy max</p>
          </div>
          <p className="text-xs text-white">Suggested level: {result.level}</p>
          <button
            type="button"
            className="min-h-11 mt-2 rounded-md px-3 py-2 text-xs font-medium"
            style={{ background: "rgba(45,212,191,0.18)", color: "#5eead4", border: "1px solid rgba(45,212,191,0.32)" }}
            onClick={() => {
              onApply?.(result.vdot);
              onApplyDetails?.({
                vdot: result.vdot,
                level: result.level,
                distance: distanceKey,
                minutes,
                seconds,
              });
              onLevelSuggested?.(result.level);
            }}
          >
            Apply VDOT
          </button>
        </div>
      )}
    </div>
  );
}
