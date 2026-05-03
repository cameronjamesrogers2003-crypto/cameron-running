"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatPace } from "@/lib/strava";
import type { CalendarRun, CalendarData } from "./types";

interface Props {
  year: number;
  todayKey: string;
  calendarData: CalendarData;
  pbPaceSecKm: number | null;
  athleteAge: number;
}

// ── style helpers ──────────────────────────────────────────────────────────

function cellColors(rating: number): { bg: string; text: string } {
  if (rating >= 8.5) return { bg: "#1a1428", text: "#AFA9EC" };
  if (rating >= 7.0) return { bg: "#0a1e0f", text: "#5DCAA5" };
  if (rating >= 5.5) return { bg: "#0a0f1e", text: "#85B7EB" };
  if (rating >= 4.0) return { bg: "#2e1e0a", text: "#EF9F27" };
  return                   { bg: "#2e1010", text: "#F09595" };
}

function typePillStyle(type: string): { background: string; color: string } {
  switch (type) {
    case "easy":     return { background: "#1e1b4b", color: "#a5b4fc" };
    case "tempo":    return { background: "#134e4a", color: "#5eead4" };
    case "interval": return { background: "#431407", color: "#fb923c" };
    case "long":     return { background: "#292524", color: "#d6d3d1" };
    default:         return { background: "#1a1a1a", color: "#9ca3af" };
  }
}

function fmtDate(isoStr: string): string {
  // Format as DD/MM/YYYY · Day
  const d = new Date(isoStr);
  // Shift to AEST for display
  const a = new Date(d.getTime() + 10 * 60 * 60 * 1000);
  const dd   = String(a.getUTCDate()).padStart(2, "0");
  const mm   = String(a.getUTCMonth() + 1).padStart(2, "0");
  const yyyy = a.getUTCFullYear();
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const dow  = days[a.getUTCDay()];
  return `${dd}/${mm}/${yyyy} · ${dow}`;
}

function fmtPaceMin(secPerKm: number): string {
  if (!secPerKm) return "—";
  const m = Math.floor(secPerKm / 60);
  const s = secPerKm % 60;
  return `${m}:${String(s).padStart(2, "0")} /km`;
}

function fmtDuration(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

// ── MonthCard ────────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

interface MonthCardProps {
  year: number;
  month: number; // 1-based
  todayKey: string;
  calendarData: CalendarData;
  selectedKey: string | null;
  onSelect: (key: string | null) => void;
}

function MonthCard({ year, month, todayKey, calendarData, selectedKey, onSelect }: MonthCardProps) {
  // First AEST calendar day of month: AEST midnight on the 1st
  // AEST midnight = UTC 14:00 of previous day
  const firstDayUTC = new Date(Date.UTC(year, month - 1, 1) - 10 * 60 * 60 * 1000);
  const firstDayAEST = new Date(firstDayUTC.getTime() + 10 * 60 * 60 * 1000);
  // Monday-first day-of-week: 0=Mon … 6=Sun
  const startDow = (firstDayAEST.getUTCDay() + 6) % 7;

  // Days in month (using AEST context)
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

  // Is this month entirely in the future?
  const [todayYear, todayMonth] = todayKey.split("-").map(Number);
  const isFuture = year > todayYear || (year === todayYear && month > todayMonth);

  // Build grid cells
  const cells: Array<string | null> = [];
  for (let i = 0; i < startDow; i++) cells.push(null); // leading empty
  for (let d = 1; d <= daysInMonth; d++) {
    const key = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    cells.push(key);
  }
  // Pad trailing to complete last row
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div
      className="rounded-lg p-2.5"
      style={{
        background: "#111111",
        border: "0.5px solid rgba(255,255,255,0.06)",
        opacity: isFuture ? 0.3 : 1,
      }}
    >
      <p className="text-xs font-semibold text-white mb-2 px-0.5">
        {MONTH_NAMES[month - 1]}
      </p>
      {/* Weekday headers */}
      <div className="grid grid-cols-7 mb-1">
        {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
          <div
            key={i}
            className="text-center text-[9px] font-medium"
            style={{ color: "rgba(156,163,175,0.4)" }}
          >
            {d}
          </div>
        ))}
      </div>
      {/* Day cells grid */}
      <div className="grid grid-cols-7 gap-y-0.5">
        {cells.map((key, i) => {
          if (!key) {
            return <div key={i} style={{ minHeight: 22 }} />;
          }

          const runs   = isFuture ? [] : (calendarData[key] ?? []);
          const isToday = key === todayKey;
          const isSelected = key === selectedKey;

          if (!runs.length) {
            // Empty day
            const [, , dayStr] = key.split("-");
            return (
              <div
                key={key}
                className="flex items-center justify-center cursor-default"
                style={{ minHeight: 22, borderRadius: 3 }}
              >
                <span
                  className="text-[8px]"
                  style={{
                    color: "rgba(156,163,175,0.2)",
                    ...(isToday ? { outline: "0.5px solid rgba(255,255,255,0.35)", borderRadius: 3 } : {}),
                  }}
                >
                  {parseInt(dayStr)}
                </span>
              </div>
            );
          }

          // Day with runs — use highest rating
          const bestRun   = runs.reduce((b, r) => (r.rating?.total ?? 0) > (b.rating?.total ?? 0) ? r : b, runs[0]);
          const hasRating = bestRun.rating != null;
          const colors    = hasRating ? cellColors(bestRun.rating!.total) : { bg: "#181818", text: "rgba(232,230,224,0.3)" };
          const [, , dayStr] = key.split("-");

          return (
            <div
              key={key}
              className="relative flex flex-col items-center justify-center cursor-pointer select-none"
              style={{
                minHeight: 22,
                borderRadius: 3,
                background: colors.bg,
                ...(isToday ? { outline: "0.5px solid rgba(255,255,255,0.35)" } : {}),
                ...(isSelected ? { outline: "1px solid rgba(255,255,255,0.4)" } : {}),
              }}
              onClick={() => onSelect(isSelected ? null : key)}
            >
              <span className="text-[9px] font-semibold leading-none" style={{ color: colors.text }}>
                {hasRating ? bestRun.rating!.total.toFixed(1) : "—"}
              </span>
              <span className="text-[8px] leading-none mt-0.5" style={{ color: "rgba(156,163,175,0.4)" }}>
                {parseInt(dayStr)}
              </span>
              {runs.length > 1 && (
                <div
                  className="absolute bottom-0.5"
                  style={{ width: 3, height: 3, borderRadius: "50%", background: colors.text, opacity: 0.7 }}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── DetailPanel ───────────────────────────────────────────────────────────────

function DetailPanel({
  runs,
  onClose,
}: {
  runs: CalendarRun[];
  onClose: () => void;
}) {
  const [tabIdx, setTabIdx] = useState(0);
  const run = runs[tabIdx] ?? runs[0];

  return (
    <div
      className="rounded-xl mt-3 p-4"
      style={{
        background: "#181818",
        borderTop: "0.5px solid rgba(255,255,255,0.08)",
        border: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      {/* Header row */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3 flex-wrap">
          {runs.length > 1 && (
            <div className="flex gap-1">
              {runs.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setTabIdx(i)}
                  className="text-xs px-2 py-0.5 rounded-md"
                  style={{
                    background: i === tabIdx ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.04)",
                    color: i === tabIdx ? "white" : "var(--text-muted)",
                  }}
                >
                  Run {i + 1}
                </button>
              ))}
            </div>
          )}
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            {fmtDate(run.dateIso)}
          </span>
        </div>
        <button
          onClick={onClose}
          className="text-xs px-2 py-1 rounded-md"
          style={{ color: "var(--text-muted)", background: "rgba(255,255,255,0.06)" }}
        >
          Close
        </button>
      </div>

      <div className="grid grid-cols-[1fr_auto] gap-6 items-start">
        {/* Left: type + rating */}
        <div className="space-y-3">
          {/* Run type pill */}
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className="text-xs px-2 py-0.5 rounded-full font-medium"
              style={typePillStyle(run.runType)}
            >
              {run.runType.charAt(0).toUpperCase() + run.runType.slice(1)}
            </span>
            {!run.isPlanned && (
              <span className="text-xs" style={{ color: "rgba(156,163,175,0.5)" }}>
                (unplanned)
              </span>
            )}
          </div>

          {/* Run name */}
          {run.name && (
            <p className="text-sm text-white">{run.name}</p>
          )}

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Distance",  value: `${run.distanceKm.toFixed(2)} km` },
              { label: "Pace",      value: fmtPaceMin(run.avgPaceSecKm) },
              { label: "Duration",  value: fmtDuration(run.durationSecs) },
              { label: "Avg HR",    value: run.avgHeartRate ? `${run.avgHeartRate} bpm` : "—" },
              { label: "Cadence",   value: "—" },
              { label: "Temp",      value: run.temperatureC != null ? `${run.temperatureC}°C` : "—" },
              { label: "Humidity",  value: run.humidityPct  != null ? `${run.humidityPct}%`  : "—" },
              { label: "Elevation", value: run.elevationGainM != null ? `${run.elevationGainM}m` : "—" },
            ].map(({ label, value }) => (
              <div key={label}>
                <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>{label}</p>
                <p className="text-xs font-semibold text-white">{value}</p>
              </div>
            ))}
          </div>

          {/* Notes */}
          <p className="text-xs" style={{ color: "rgba(156,163,175,0.4)" }}>
            No notes
          </p>

          {/* Strava link */}
          <a
            href={`https://www.strava.com/activities/${run.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs inline-flex items-center gap-1"
            style={{ color: "#fb923c" }}
          >
            View on Strava →
          </a>
        </div>

        {/* Right: rating badge + components */}
        {run.rating ? (
          <div className="space-y-3 w-44">
            {/* Large rating badge */}
            {(() => {
              const score = run.rating.total;
              const c = score >= 9   ? { bg: "#2e1065", text: "#c4b5fd" }
                      : score >= 7.5 ? { bg: "#052e16", text: "#4ade80" }
                      : score >= 6   ? { bg: "#0c1a2e", text: "#60a5fa" }
                      : score >= 4   ? { bg: "#431407", text: "#fb923c" }
                      :                { bg: "#450a0a", text: "#f87171" };
              return (
                <div
                  className="flex items-center justify-center rounded-xl"
                  style={{ background: c.bg, height: 56 }}
                >
                  <span className="text-3xl font-bold" style={{ color: c.text }}>
                    {score.toFixed(1)}
                  </span>
                </div>
              );
            })()}
            {/* Component scores */}
            {[
              { label: "Pace",        value: run.rating.pace },
              { label: "Effort / HR", value: run.rating.effort },
              { label: "Distance",    value: run.rating.distance },
              { label: "Conditions",  value: run.rating.conditions },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center gap-2">
                <span className="text-xs shrink-0" style={{ color: "var(--text-muted)", width: 72 }}>
                  {label}
                </span>
                <div
                  className="flex-1 rounded-sm overflow-hidden"
                  style={{ height: 3, background: "rgba(255,255,255,0.06)" }}
                >
                  <div
                    style={{
                      width: `${(value / 2.5) * 100}%`,
                      height: "100%",
                      background: "#fb923c",
                      borderRadius: 2,
                    }}
                  />
                </div>
                <span className="text-xs text-white shrink-0" style={{ width: 24, textAlign: "right" }}>
                  {value.toFixed(1)}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div
            className="flex items-center justify-center rounded-xl w-44"
            style={{ background: "#181818", height: 56 }}
          >
            <span className="text-sm" style={{ color: "var(--text-muted)" }}>Unrated</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── CalendarGrid (main export) ────────────────────────────────────────────────

export default function CalendarGrid({ year, todayKey, calendarData }: Props) {
  const router       = useRouter();
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const selectedRuns = selectedKey ? (calendarData[selectedKey] ?? []) : [];

  function handleSelect(key: string | null) {
    setSelectedKey((prev) => (prev === key ? null : key));
  }

  const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

  return (
    <div>
      {/* Year navigation */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => {
            setSelectedKey(null);
            router.push(`/calendar?year=${year - 1}`);
          }}
          className="text-sm px-3 py-1.5 rounded-lg"
          style={{
            background: "rgba(255,255,255,0.06)",
            color: "var(--text-muted)",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          ← {year - 1}
        </button>
        <span className="text-base font-semibold text-white">{year}</span>
        <button
          onClick={() => {
            setSelectedKey(null);
            router.push(`/calendar?year=${year + 1}`);
          }}
          className="text-sm px-3 py-1.5 rounded-lg"
          style={{
            background: "rgba(255,255,255,0.06)",
            color: "var(--text-muted)",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          {year + 1} →
        </button>
      </div>

      {/* 3×4 month grid */}
      <div className="grid grid-cols-3 gap-3">
        {MONTHS.map((month) => (
          <MonthCard
            key={month}
            year={year}
            month={month}
            todayKey={todayKey}
            calendarData={calendarData}
            selectedKey={selectedKey}
            onSelect={handleSelect}
          />
        ))}
      </div>

      {/* Inline detail panel */}
      {selectedKey && selectedRuns.length > 0 && (
        <DetailPanel
          runs={selectedRuns}
          onClose={() => setSelectedKey(null)}
        />
      )}
    </div>
  );
}
