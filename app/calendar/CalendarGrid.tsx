"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatDuration, formatPace } from "@/lib/settings";
import type { CalendarRun, CalendarData, PlannedDayMeta } from "./types";
import { formatAEST } from "@/lib/dateUtils";
import { RunTypePill } from "@/components/RunTypePill";
import { useTheme } from "@/context/ThemeContext";

interface Props {
  year: number;
  todayKey: string;
  calendarData: CalendarData;
  plannedDayMeta: PlannedDayMeta;
}

// ── style helpers ──────────────────────────────────────────────────────────

function cellColors(rating: number): { bg: string; text: string } {
  if (rating >= 8.5) return { bg: "#1a1428", text: "#AFA9EC" };
  if (rating >= 7.0) return { bg: "#0a1e0f", text: "#5DCAA5" };
  if (rating >= 5.5) return { bg: "#0a0f1e", text: "#85B7EB" };
  if (rating >= 4.0) return { bg: "#2e1e0a", text: "#EF9F27" };
  return                   { bg: "#2e1010", text: "#F09595" };
}

function fmtDate(isoStr: string): string {
  return formatAEST(isoStr, "dd/MM/yyyy · EEE");
}

function fmtPaceMin(secPerKm: number): string {
  return secPerKm > 0 ? `${formatPace(secPerKm)} /km` : "—";
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
function ratingTextColor(score: number): string {
  if (score >= 9.0) return "#a78bfa";
  if (score >= 7.0) return "#4ade80";
  if (score >= 5.5) return "var(--accent)";
  if (score >= 4.0) return "#f5b454";
  return "#f87171";
}

function ratingBadgeStyle(score: number): { bg: string; color: string } {
  if (score >= 9.0) return { bg: "rgba(167,139,250,0.25)", color: "#a78bfa" };
  if (score >= 7.0) return { bg: "rgba(74,222,128,0.25)", color: "#4ade80" };
  if (score >= 5.5) return { bg: "rgba(45,212,191,0.25)", color: "var(--accent)" };
  if (score >= 4.0) return { bg: "rgba(245,180,84,0.25)", color: "#f5b454" };
  return { bg: "rgba(248,113,113,0.25)", color: "#f87171" };
}

function ratingCellTint(score: number): string {
  if (score >= 7.0) return "rgba(74,222,128,0.05)";
  if (score >= 5.5) return "rgba(45,212,191,0.05)";
  if (score >= 4.0) return "rgba(245,180,84,0.04)";
  return "rgba(248,113,113,0.04)";
}

function ratingBand(score: number): string {
  if (score >= 9.0) return "Elite";
  if (score >= 7.0) return "Strong";
  if (score >= 5.5) return "Solid";
  if (score >= 4.0) return "Rough";
  return "Off Day";
}

function breakdownRows(json: string | null | undefined): Array<{ label: string; score: number; max: number; color: string }> {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json) as {
      components?: {
        pace?: { score: number; max: number };
        effort?: { score: number; max: number };
        distance?: { score: number; max: number };
        conditions?: { score: number; max: number };
      };
    };
    const c = parsed.components;
    if (!c?.pace || !c.effort || !c.distance || !c.conditions) return [];
    return [
      { label: "Pace", score: c.pace.score, max: c.pace.max, color: "var(--c-interval)" },
      { label: "Effort", score: c.effort.score, max: c.effort.max, color: "var(--c-easy)" },
      { label: "Distance", score: c.distance.score, max: c.distance.max, color: "var(--c-long)" },
      { label: "Conditions", score: c.conditions.score, max: c.conditions.max, color: "#f5b454" },
    ];
  } catch {
    return [];
  }
}

export default function CalendarGrid({ year, todayKey, calendarData, plannedDayMeta }: Props) {
  const router = useRouter();
  const { theme } = useTheme();
  const [viewMonth, setViewMonth] = useState(Number(todayKey.split("-")[1]));
  const [modalRun, setModalRun] = useState<CalendarRun | null>(null);
  const todayMonth = Number(todayKey.split("-")[1]);
  const todayYear = Number(todayKey.split("-")[0]);
  const isCurrentYear = year === todayYear;
  const isLight = theme === "light";
  const ctrlBg = isLight ? "rgba(15,23,42,0.06)" : "rgba(255,255,255,0.06)";
  const ctrlBorder = isLight ? "rgba(15,23,42,0.12)" : "rgba(255,255,255,0.08)";
  const cellBase = isLight ? "rgba(255,255,255,0.92)" : "rgba(255,255,255,0.02)";
  const modalBg = isLight ? "#f8fafc" : "#111214";
  const modalBorder = isLight ? "1px solid rgba(15,23,42,0.12)" : "1px solid rgba(255,255,255,0.10)";

  const firstOfMonth = new Date(Date.UTC(year, viewMonth - 1, 1) - 10 * 60 * 60 * 1000);
  const firstDow = (new Date(firstOfMonth.getTime() + 10 * 60 * 60 * 1000).getUTCDay() + 6) % 7;
  const daysInMonth = new Date(Date.UTC(year, viewMonth, 0)).getUTCDate();
  const prevMonthDays = new Date(Date.UTC(year, viewMonth - 1, 0)).getUTCDate();

  const cells: Array<{ key: string; day: number; inMonth: boolean }> = [];
  for (let i = firstDow - 1; i >= 0; i--) {
    const day = prevMonthDays - i;
    const month = viewMonth - 1;
    const y = month < 1 ? year - 1 : year;
    const m = month < 1 ? 12 : month;
    cells.push({ key: `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`, day, inMonth: false });
  }
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push({ key: `${year}-${String(viewMonth).padStart(2, "0")}-${String(day).padStart(2, "0")}`, day, inMonth: true });
  }
  while (cells.length % 7 !== 0) {
    const nextDay = cells.length - (firstDow + daysInMonth) + 1;
    const month = viewMonth + 1;
    const y = month > 12 ? year + 1 : year;
    const m = month > 12 ? 1 : month;
    cells.push({ key: `${y}-${String(m).padStart(2, "0")}-${String(nextDay).padStart(2, "0")}`, day: nextDay, inMonth: false });
  }

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="w-6 h-6 rounded-lg transition-colors"
            style={{ background: ctrlBg, border: `1px solid ${ctrlBorder}` }}
            onClick={() => router.push(`/calendar?year=${year - 1}`)}
          >
            ←
          </button>
          <p className="text-sm font-semibold text-white">{year}</p>
          <button
            type="button"
            className="w-6 h-6 rounded-lg transition-colors"
            style={{ background: ctrlBg, border: `1px solid ${ctrlBorder}` }}
            onClick={() => router.push(`/calendar?year=${year + 1}`)}
          >
            →
          </button>
        </div>
        <button
          type="button"
          className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
          style={{ background: "rgba(45,212,191,0.10)", border: "1px solid rgba(45,212,191,0.25)", color: "var(--accent)" }}
          onClick={() => {
            if (!isCurrentYear) router.push(`/calendar?year=${todayYear}`);
            setViewMonth(todayMonth);
          }}
        >
          Today
        </button>
      </div>

      <div className="flex gap-1 mb-4 overflow-x-auto pb-1">
        {["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"].map((label, i) => {
          const monthNum = i + 1;
          const active = monthNum === viewMonth;
          const isTodayMonth = isCurrentYear && monthNum === todayMonth && !active;
          return (
            <button
              key={label}
              type="button"
              onClick={() => setViewMonth(monthNum)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all shrink-0 whitespace-nowrap"
              style={
                active
                  ? { background: "rgba(45,212,191,0.15)", border: "1px solid rgba(45,212,191,0.30)", color: "var(--accent)" }
                  : isTodayMonth
                    ? { background: "rgba(255,255,255,0.08)", color: "white" }
                    : { background: isLight ? "rgba(15,23,42,0.06)" : "rgba(255,255,255,0.04)", color: isLight ? "rgba(15,23,42,0.56)" : "rgba(255,255,255,0.40)" }
              }
            >
              {label}
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between mb-4">
        <button
          type="button"
          className="flex items-center justify-center w-9 h-9 rounded-xl transition-colors bg-white/[0.06] border border-white/[0.08] hover:bg-white/[0.10] cursor-pointer"
          style={{ background: ctrlBg, border: `1px solid ${ctrlBorder}` }}
          onClick={() => setViewMonth((m) => (m === 1 ? 12 : m - 1))}
        >
          ‹
        </button>
        <h2 className="text-xl font-bold text-white">{MONTH_NAMES[viewMonth - 1]} {year}</h2>
        <button
          type="button"
          className="flex items-center justify-center w-9 h-9 rounded-xl transition-colors bg-white/[0.06] border border-white/[0.08] hover:bg-white/[0.10] cursor-pointer"
          style={{ background: ctrlBg, border: `1px solid ${ctrlBorder}` }}
          onClick={() => setViewMonth((m) => (m === 12 ? 1 : m + 1))}
        >
          ›
        </button>
      </div>

      <div className="grid grid-cols-7 mb-2">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <div key={d} className="text-xs font-semibold text-center uppercase tracking-widest py-2" style={{ color: "var(--text-label)" }}>
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {cells.map((cell) => {
          const runs = calendarData[cell.key] ?? [];
          const planMeta = plannedDayMeta[cell.key];
          const isToday = cell.key === todayKey;
          const bestRun = runs.length > 0 ? runs.reduce((b, r) => (r.rating ?? -1) > (b.rating ?? -1) ? r : b, runs[0]) : null;
          const bestRating = bestRun?.rating ?? null;
          const badge = bestRating != null ? ratingBadgeStyle(bestRating) : null;
          const canOpen = Boolean(bestRun);
          return (
            <div
              key={cell.key}
              className={`relative rounded-xl p-2.5 flex flex-col transition-all ${canOpen ? "cursor-pointer hover:brightness-125" : "cursor-default"}`}
              style={{
                background: bestRating != null
                  ? ratingCellTint(bestRating)
                  : planMeta?.kind === "missed"
                    ? (isLight ? "rgba(245,180,84,0.10)" : "rgba(245,180,84,0.03)")
                    : cellBase,
                border: isToday
                  ? "1px solid rgba(45,212,191,0.25)"
                  : planMeta?.kind === "planned"
                    ? "1px solid rgba(45,212,191,0.15)"
                    : planMeta?.kind === "missed"
                      ? "1px solid rgba(245,180,84,0.12)"
                      : undefined,
                minHeight: cell.inMonth ? 90 : 60,
                opacity: cell.inMonth ? 1 : 0.2,
              }}
              onClick={() => {
                if (bestRun) setModalRun(bestRun);
              }}
            >
              <span className="text-xs font-mono font-semibold self-start" style={{ color: isToday ? "var(--accent)" : "var(--text-muted)" }}>
                {cell.day}
              </span>
              {bestRun && (
                <>
                  <p className="text-xs font-mono font-semibold text-white mt-auto leading-tight">{bestRun.distanceKm.toFixed(2)} km</p>
                  {badge && (
                    <span className="inline-flex px-1.5 py-0.5 rounded-md text-xs font-black font-mono tabular-nums mt-0.5" style={{ background: badge.bg, color: badge.color }}>
                      {bestRun.rating?.toFixed(1)}
                    </span>
                  )}
                </>
              )}
              {!bestRun && planMeta?.kind === "planned" && (
                <>
                  <div className="mt-auto mx-auto w-1.5 h-1.5 rounded-full mb-0.5" style={{ background: "var(--accent)", opacity: 0.6 }} />
                  <p className="text-center" style={{ fontSize: "0.55rem", color: "var(--accent)", opacity: 0.7 }}>
                    {planMeta.runType}
                  </p>
                </>
              )}
              {!bestRun && planMeta?.kind === "missed" && (
                <div className="mt-auto mx-auto w-1.5 h-1.5 rounded-full mb-0.5" style={{ background: "#f5b454", opacity: 0.6 }} />
              )}
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-4 mt-4 flex-wrap">
        <div className="flex items-center gap-1.5 text-xs" style={{ color: "var(--text-muted)" }}><span className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--accent)" }} /> Planned</div>
        <div className="flex items-center gap-1.5 text-xs" style={{ color: "var(--text-muted)" }}><span className="w-1.5 h-1.5 rounded-full" style={{ background: "#f5b454" }} /> Missed</div>
        {[
          { label: "Strong 7+", bg: "rgba(74,222,128,0.25)", color: "#4ade80" },
          { label: "Solid 5.5-7", bg: "rgba(45,212,191,0.25)", color: "var(--accent)" },
          { label: "Rough 4-5.5", bg: "rgba(245,180,84,0.25)", color: "#f5b454" },
          { label: "Off day <4", bg: "rgba(248,113,113,0.25)", color: "#f87171" },
        ].map((x) => (
          <div key={x.label} className="flex items-center gap-1.5 text-xs" style={{ color: "var(--text-muted)" }}>
            <span className="inline-flex px-1.5 py-0.5 rounded-md text-[10px] font-black font-mono" style={{ background: x.bg, color: x.color }}>
              ■
            </span>
            {x.label}
          </div>
        ))}
      </div>

      {modalRun && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: isLight ? "rgba(15,23,42,0.28)" : "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)" }}
          onClick={() => setModalRun(null)}
        >
          <div
            className="relative w-full max-w-sm rounded-2xl p-5 shadow-2xl"
            style={{ background: modalBg, border: modalBorder }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="absolute top-4 right-4 w-7 h-7 rounded-full flex items-center justify-center hover:bg-white/[0.10] transition-colors cursor-pointer"
              style={{ color: "var(--text-muted)" }}
              onClick={() => setModalRun(null)}
            >
              ✕
            </button>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>{fmtDate(modalRun.dateIso)}</p>
            <p className="text-lg font-bold text-white mt-0.5">{modalRun.name ?? "Run"}</p>

            <div className="flex items-center gap-3 mt-3 flex-wrap">
              <RunTypePill type={modalRun.runType} size="sm" />
              <span className="text-sm font-mono" style={{ color: "var(--text-muted)" }}>
                {modalRun.distanceKm.toFixed(2)} km · {fmtPaceMin(modalRun.avgPaceSecKm)} · {formatDuration(modalRun.durationSecs)}
              </span>
            </div>

            {modalRun.rating != null && (
              <>
                <p className="text-5xl font-black font-mono tabular-nums text-center my-4" style={{ color: ratingTextColor(modalRun.rating) }}>
                  {modalRun.rating.toFixed(1)}
                </p>
                <p className="text-xs text-center -mt-2 mb-3" style={{ color: ratingTextColor(modalRun.rating) }}>
                  {ratingBand(modalRun.rating)}
                </p>
              </>
            )}

            <p className="text-xs font-semibold tracking-widest uppercase mb-2" style={{ color: "var(--text-label)" }}>
              Score Breakdown
            </p>
            {breakdownRows(modalRun.ratingBreakdown).length === 0 ? (
              <p className="text-xs" style={{ color: "var(--text-dim)" }}>No breakdown available</p>
            ) : (
              breakdownRows(modalRun.ratingBreakdown).map((row) => (
                <div key={row.label} className="flex items-center gap-2 mb-2">
                  <p className="w-20 text-xs" style={{ color: "var(--text-muted)" }}>{row.label}</p>
                  <div className="flex-1 h-1.5 rounded-full bg-white/[0.08] overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${Math.max(0, Math.min(100, (row.score / Math.max(row.max, 0.01)) * 100))}%`, background: row.color }} />
                  </div>
                  <p className="w-14 text-right text-xs font-mono" style={{ color: "var(--text-muted)" }}>
                    {row.score.toFixed(1)} / {row.max.toFixed(1)}
                  </p>
                </div>
              ))
            )}

            <div className="mt-4 pt-3 border-t border-white/[0.08] flex items-center justify-between">
              <p className="text-xs" style={{ color: "var(--text-dim)" }}>
                {modalRun.classificationMethod ?? "Classification unavailable"}
              </p>
              <a
                href={`https://www.strava.com/activities/${modalRun.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-semibold"
                style={{ color: "#f97316" }}
              >
                View on Strava
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
