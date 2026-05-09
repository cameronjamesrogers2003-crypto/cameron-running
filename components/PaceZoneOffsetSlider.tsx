"use client";

import { formatPace } from "@/lib/settings";
import { getSliderBaseSecKm } from "@/lib/planPaces";
import { FORM_CONTROL_TW } from "@/lib/formControlClasses";

export type PaceZoneKey = "easy" | "tempo" | "interval" | "long";

function bandCopy(offset: number): { label: string; key: string } {
  if (offset < -30) return { label: "⚠️ High Injury Risk", key: "risk" };
  if (offset < -10) return { label: "Aggressive", key: "aggr" };
  if (offset <= 10) return { label: "✓ Target Zone", key: "ok" };
  if (offset <= 30) return { label: "Conservative", key: "cons" };
  return { label: "May reduce training effectiveness", key: "slow" };
}

const TRACK_GRADIENT =
  "linear-gradient(to right,"
  + " #c0392b 0%, #c0392b 16.67%,"
  + " #e67e22 16.67%, #e67e22 27.78%,"
  + " #1abc9c 27.78%, #1abc9c 38.89%,"
  + " #e67e22 38.89%, #e67e22 50%,"
  + " #a04000 50%, #a04000 100%"
  + ")";

export default function PaceZoneOffsetSlider({
  zone,
  label,
  vdot,
  runningExperience,
  offsetSec,
  onOffsetChange,
}: {
  zone: PaceZoneKey;
  label: string;
  vdot: number;
  runningExperience: string | null;
  offsetSec: number;
  onOffsetChange: (next: number) => void;
}) {
  const baseSec = getSliderBaseSecKm(zone, vdot, runningExperience);
  const finalSec = baseSec + offsetSec;
  const { label: bandLabel, key: bandKey } = bandCopy(offsetSec);
  const vdotLabel = formatPace(baseSec);

  return (
    <div className="space-y-2">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
        <p className="text-base font-semibold text-white">{label}</p>
        <p className="text-base font-mono font-semibold tabular-nums" style={{ color: "var(--accent)" }}>
          {formatPace(finalSec)}/km
        </p>
      </div>
      <p className="text-xs mt-0.5" style={{ color: "var(--text-dim)" }}>
        {offsetSec === 0
          ? "Aligned with VDOT recommendation"
          : offsetSec > 0
            ? `+${offsetSec}s from VDOT recommendation`
            : `${offsetSec}s from VDOT recommendation`}
      </p>

      <div className="relative pt-2 pb-6">
        <div
          className="relative h-3 rounded-full overflow-hidden"
          style={{ background: TRACK_GRADIENT }}
        >
          <div
            className="absolute top-0 bottom-0 w-px bg-white/90 pointer-events-none z-10"
            style={{ left: "33.333%", boxShadow: "0 0 0 1px rgba(0,0,0,0.35)" }}
            title="VDOT baseline"
          />
        </div>
        <input
          type="range"
          min={-60}
          max={120}
          step={1}
          value={offsetSec}
          onChange={(e) => onOffsetChange(Number(e.target.value))}
          className={`absolute inset-x-0 top-2 w-full h-3 opacity-0 cursor-pointer z-20 rounded-md ${FORM_CONTROL_TW}`}
          aria-label={`${label} pace offset`}
        />
        <div
          className="absolute pointer-events-none"
          style={{
            left: `calc(${((offsetSec + 60) / 180) * 100}% - 6px)`,
            top: "2px",
            zIndex: 15,
            width: 12,
            height: 12,
            borderRadius: 9999,
            background: "#fff",
            border: "2px solid rgba(45,212,191,0.85)",
            boxShadow: "0 1px 4px rgba(0,0,0,0.45)",
          }}
        />
        <p
          className="absolute text-[10px] whitespace-nowrap pointer-events-none"
          style={{ left: "33.333%", transform: "translateX(-50%)", top: "22px", color: "rgba(255,255,255,0.55)" }}
        >
          VDOT: {vdotLabel}/km
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p
          className="text-xs font-medium"
          style={{
            color:
              bandKey === "ok" ? "#5eead4"
              : bandKey === "risk" || bandKey === "slow" ? "#e67e22"
              : "#f1c40f",
          }}
        >
          {bandLabel}
        </p>
        <button
          type="button"
          onClick={() => onOffsetChange(0)}
          className="text-xs px-3 py-1.5 rounded-lg transition-colors disabled:opacity-30"
          style={{
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.10)",
            color: "rgba(255,255,255,0.50)",
          }}
          disabled={offsetSec === 0}
        >
          ↺ Reset to VDOT
        </button>
      </div>
    </div>
  );
}
