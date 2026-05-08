"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { CSSProperties } from "react";
import { parseRatingBreakdown } from "@/lib/rating";
import type { RunType } from "@/data/trainingPlan";
import { formatPace, formatDuration } from "@/lib/settings";
import { FORM_CONTROL_TW } from "@/lib/formControlClasses";
import { RunTypePill } from "@/components/RunTypePill";
import { runTypeColor } from "@/lib/runTypeStyles";
import { EmptyState } from "@/components/EmptyState";
import { Activity } from "lucide-react";

interface Run {
  id: string;
  name: string | null;
  dateIso: string;
  dateAest: string;
  distanceKm: number;
  durationSecs: number;
  avgPaceSecKm: number;
  avgHeartRate: number | null;
  maxHeartRate: number | null;
  calories: number | null;
  elevationGainM: number | null;
  temperatureC: number | null;
  humidityPct: number | null;
  activityType: string;
  runType: RunType;
  rating: number | null;
  ratingBreakdown: string | null;
  classificationMethod: string | null;
}

interface RunsResponse {
  data: Run[];
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
}

const RUN_TYPES: RunType[] = ["easy", "tempo", "interval", "long"];

const TYPE_COLORS: Record<RunType, string> = {
  easy:     "#5DCAA5",
  tempo:    "#F5C542",
  interval: "#AFA9EC",
  long:     "#85B7EB",
};

function ratingColor(score: number): string {
  if (score >= 9.0) return "#a78bfa";
  if (score >= 7.0) return "#4ade80";
  if (score >= 5.5) return "var(--accent)";
  if (score >= 4.0) return "#f5b454";
  return "#f87171";
}

function ratingBand(score: number): string {
  if (score >= 9.0) return "Elite";
  if (score >= 7.0) return "Strong";
  if (score >= 5.5) return "Solid";
  if (score >= 4.0) return "Rough";
  return "Off Day";
}

function RatingBreakdownPanel({ json, rating }: { json: string | null; rating: number }) {
  const parsed = parseRatingBreakdown(json);
  if (!parsed) {
    return (
      <p className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
        Run the backfill to generate breakdown data.
      </p>
    );
  }
  const c = parsed.components;
  const line = (
    label: string,
    score: number,
    max: number,
    reason: string,
    barColor: string,
  ) => (
    <div key={label}>
      <div className="flex items-center gap-3 mb-2">
        <span className="text-xs font-semibold w-24 shrink-0" style={{ color: "var(--text-muted)" }}>
          {label}
        </span>
        <div className="flex-1 h-1.5 rounded-full bg-white/[0.08] overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${Math.max(0, Math.min(100, (score / Math.max(0.01, max)) * 100))}%`, background: barColor }}
          />
        </div>
        <span className="text-xs font-mono font-semibold w-16 text-right shrink-0" style={{ color: "var(--text-muted)" }}>
          {score.toFixed(1)} / {max.toFixed(1)}
        </span>
      </div>
      <p className="text-xs ml-[108px] mb-2 leading-relaxed" style={{ color: "var(--text-dim)" }}>
        {reason}
      </p>
    </div>
  );
  return (
    <div className="max-w-xl">
      <p className="text-xs font-semibold tracking-widest uppercase mb-3" style={{ color: "var(--text-label)" }}>
        Run Score Breakdown
      </p>
      {line("Pace Quality", c.pace.score, c.pace.max, c.pace.reason, "var(--c-interval)")}
      {line("Effort", c.effort.score, c.effort.max, c.effort.reason, "var(--c-easy)")}
      {line("Distance", c.distance.score, c.distance.max, c.distance.reason, "var(--c-long)")}
      {line("Conditions", c.conditions.score, c.conditions.max, c.conditions.reason, "#f5b454")}
      <div
        className="border-t border-white/[0.08] pt-2 mt-1"
        style={{ borderColor: "rgba(255,255,255,0.08)" }}
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold tracking-widest uppercase" style={{ color: "var(--text-muted)" }}>
            Total
          </span>
          <div className="flex items-center">
            <span className="text-lg font-black font-mono tabular-nums" style={{ color: ratingColor(rating) }}>
              {parsed.total.toFixed(1)}
            </span>
            <span className="text-xs font-semibold ml-2" style={{ color: ratingColor(rating) }}>
              {ratingBand(rating)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function SortIcon({ active, dir }: { active: boolean; dir: "asc" | "desc" }) {
  return (
    <span className="ml-1 inline-block" style={{ opacity: active ? 1 : 0.3 }}>
      {dir === "asc" ? "↑" : "↓"}
    </span>
  );
}

export default function RunsClient({
  intervalThresholdSec: _intervalThresholdSec,
  tempoThresholdSec: _tempoThresholdSec,
}: {
  intervalThresholdSec: number;
  tempoThresholdSec: number;
}) {
  const [runs,      setRuns]      = useState<Run[]>([]);
  const [total,     setTotal]     = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page,      setPage]      = useState(1);
  const [loading,   setLoading]   = useState(true);

  // Filters
  const [search,    setSearch]    = useState("");
  const [types,     setTypes]     = useState<RunType[]>([]);
  const [dateFrom,  setDateFrom]  = useState("");
  const [dateTo,    setDateTo]    = useState("");
  const [distMin,   setDistMin]   = useState("");
  const [distMax,   setDistMax]   = useState("");
  const [sortBy,    setSortBy]    = useState("date");
  const [order,     setOrder]     = useState<"asc" | "desc">("desc");

  // Expanded rows (detail) vs rating breakdown panel
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [ratingBreakdownOpen, setRatingBreakdownOpen] = useState<Set<string>>(new Set());

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchRuns = useCallback(async (pg: number) => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(pg), perPage: "25", sort: sortBy, order });
    if (search)   params.set("search",   search);
    if (types.length) params.set("type", types.join(","));
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo)   params.set("dateTo",   dateTo);
    if (distMin)  params.set("distMin",  distMin);
    if (distMax)  params.set("distMax",  distMax);

    const res: RunsResponse = await fetch(`/api/runs?${params}`).then(r => r.json());
    setRuns(res.data);
    setTotal(res.total);
    setTotalPages(res.totalPages);
    setPage(pg);
    setLoading(false);
  }, [search, types, dateFrom, dateTo, distMin, distMax, sortBy, order]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchRuns(1), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [fetchRuns]);

  function toggleType(t: RunType) {
    setTypes(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);
  }

  function toggleSort(field: string) {
    if (sortBy === field) setOrder(o => o === "asc" ? "desc" : "asc");
    else { setSortBy(field); setOrder("desc"); }
  }

  function toggleExpand(id: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleRatingBreakdown(id: string) {
    setRatingBreakdownOpen(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const handleSync = useCallback(() => {
    window.location.href = "/api/strava/sync";
  }, []);

  function formatDateAest(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleDateString("en-AU", {
      timeZone: "Australia/Brisbane",
      day: "numeric", month: "short", year: "numeric",
    });
  }

  const filterControlBase = `px-3 py-2 rounded-xl text-sm bg-white/[0.06] border border-white/[0.10] text-white outline-none focus:border-teal-500/50 transition-colors ${FORM_CONTROL_TW}`;
  const chipStyle = (type: RunType): CSSProperties => {
    const isActive = types.includes(type);
    if (!isActive) {
      return {
        background: "rgba(255,255,255,0.06)",
        border: "1px solid rgba(255,255,255,0.10)",
        color: "rgba(255,255,255,0.50)",
      };
    }
    const colors: Record<RunType, { bg: string; border: string; text: string }> = {
      easy: { bg: "rgba(125,211,252,0.15)", border: "rgba(125,211,252,0.35)", text: "#7dd3fc" },
      tempo: { bg: "rgba(45,212,191,0.15)", border: "rgba(45,212,191,0.35)", text: "#2dd4bf" },
      interval: { bg: "rgba(249,115,22,0.15)", border: "rgba(249,115,22,0.35)", text: "#f97316" },
      long: { bg: "rgba(167,139,250,0.15)", border: "rgba(167,139,250,0.35)", text: "#a78bfa" },
    };
    const c = colors[type];
    return {
      background: c.bg,
      border: `1px solid ${c.border}`,
      color: c.text,
    };
  };

  return (
    <div className="space-y-4">
      {/* ── Filter panel ───────────────────────────────────────────────── */}
      <div className="rounded-2xl border bg-white/[0.04] border-white/[0.08] backdrop-blur-sm p-4 space-y-3">
        {/* Search */}
        <input
          type="text"
          placeholder="Search by name…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className={`w-full px-4 py-2.5 rounded-xl text-sm bg-white/[0.06] border border-white/[0.10] text-white placeholder-white/30 outline-none focus:border-teal-500/50 focus:bg-white/[0.08] transition-colors ${FORM_CONTROL_TW}`}
        />

        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          {/* Type pills */}
          <div className="flex flex-wrap gap-1.5">
            {RUN_TYPES.map(t => (
              <button
                key={t}
                type="button"
                onClick={() => toggleType(t)}
                className="px-4 py-1.5 rounded-full text-xs font-semibold cursor-pointer transition-all capitalize"
                style={chipStyle(t)}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Date range */}
          <div className="flex flex-col gap-1 w-full sm:w-auto sm:flex-row sm:items-center sm:gap-1.5">
            <span className="text-xs sm:hidden" style={{ color: "var(--text-muted)" }}>Date range</span>
            <div className="flex items-center gap-1.5 flex-1 min-w-0">
              <input
                type="date"
                value={dateFrom}
                onChange={e => setDateFrom(e.target.value)}
                className={`flex-1 min-w-0 ${filterControlBase}`}
                style={{ colorScheme: "dark" }}
              />
              <span className="text-xs shrink-0" style={{ color: "var(--text-muted)" }}>to</span>
              <input
                type="date"
                value={dateTo}
                onChange={e => setDateTo(e.target.value)}
                className={`flex-1 min-w-0 ${filterControlBase}`}
                style={{ colorScheme: "dark" }}
              />
            </div>
          </div>

          {/* Distance range */}
          <div className="flex flex-col gap-1 w-full sm:w-auto sm:flex-row sm:items-center sm:gap-1.5">
            <span className="text-xs sm:hidden" style={{ color: "var(--text-muted)" }}>Distance (km)</span>
            <div className="flex items-center gap-1.5 w-full sm:w-auto">
              <input
                type="number"
                placeholder="Dist ≥"
                value={distMin}
                onChange={e => setDistMin(e.target.value)}
                className={`w-full sm:w-24 ${filterControlBase}`}
                style={{ colorScheme: "dark" }}
              />
              <input
                type="number"
                placeholder="≤ km"
                value={distMax}
                onChange={e => setDistMax(e.target.value)}
                className={`w-full sm:w-24 ${filterControlBase}`}
                style={{ colorScheme: "dark" }}
              />
            </div>
          </div>

          {/* Clear */}
          {(search || types.length || dateFrom || dateTo || distMin || distMax) && (
            <button
              type="button"
              onClick={() => { setSearch(""); setTypes([]); setDateFrom(""); setDateTo(""); setDistMin(""); setDistMax(""); }}
              className="min-h-11 text-xs px-3 py-2 rounded-md w-full sm:w-auto"
              style={{ color: "var(--text-muted)", background: "rgba(255,255,255,0.04)" }}
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* ── Results count ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-white">
          {loading ? "Loading…" : `${total} run${total !== 1 ? "s" : ""}`}
        </p>
        <p className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>
          Page {page} of {totalPages}
        </p>
      </div>

      {/* ── Desktop table ─────────────────────────────────────────────── */}
      <div className="hidden md:block rounded-2xl border bg-white/[0.04] border-white/[0.08] backdrop-blur-sm w-full overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-2 border-b border-white/[0.10] w-full">
          {[
            { label: "Run",      field: "name"        },
            { label: "Type",     field: ""            },
            { label: "Distance", field: "distanceKm"  },
            { label: "Pace",     field: "avgPaceSecKm"},
            { label: "Time",     field: "durationSecs"},
            { label: "Date",     field: "date"        },
            { label: "Rating",   field: ""            },
          ].map(({ label, field }) => (
            <button
              key={label}
              type="button"
              onClick={() => field && toggleSort(field)}
              className={`text-xs font-semibold tracking-widest uppercase text-left ${
                label === "Run"
                  ? "flex-1 min-w-0"
                  : label === "Type"
                    ? "w-24 shrink-0"
                    : label === "Distance"
                      ? "w-24 shrink-0"
                      : label === "Pace"
                        ? "w-24 shrink-0"
                        : label === "Time"
                          ? "w-20 shrink-0 hidden md:block"
                          : label === "Date"
                            ? "w-28 shrink-0 hidden md:block"
                            : "w-16 shrink-0 text-right min-w-[60px]"
              }`}
              style={{ cursor: field ? "pointer" : "default", color: sortBy === field && field ? "var(--accent)" : "var(--text-label)" }}
            >
              {label}
              {field && <SortIcon active={sortBy === field} dir={order} />}
            </button>
          ))}
        </div>

        {/* Rows */}
        {!loading && runs.length === 0 && (
          <EmptyState
            icon={<Activity className="w-7 h-7" style={{ color: "var(--accent)" }} />}
            title="No runs yet"
            body="Connect Strava and your runs will appear here automatically after each sync."
            action={{ label: "Sync Strava", onClick: handleSync }}
          />
        )}

        {runs.map((run, i) => {
          const isOpen = expanded.has(run.id);
          const ratingOpen = ratingBreakdownOpen.has(run.id);
          return (
            <div
              key={run.id}
              className="group relative"
              style={{
                borderTop: i > 0 ? "1px solid rgba(255,255,255,0.04)" : undefined,
                borderLeft: isOpen ? `3px solid ${runTypeColor(run.runType)}` : undefined,
              }}
            >
              <div
                className="absolute left-0 top-0 bottom-0 w-0.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ background: runTypeColor(run.runType) }}
              />
              <div
                role="button"
                tabIndex={0}
                className="flex items-center gap-2 px-4 py-3 border-b border-white/[0.06] hover:bg-white/[0.03] transition-all duration-150 hover:brightness-105 active:scale-[0.998] cursor-pointer w-full outline-none focus-visible:ring-1 focus-visible:ring-white/20"
                onClick={() => toggleExpand(run.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    toggleExpand(run.id);
                  }
                }}
              >
                <span className="font-medium text-sm text-white flex-1 min-w-0 truncate">{run.name ?? "Run"}</span>
                <span className="w-24 shrink-0">
                  <RunTypePill type={run.runType} size="sm" />
                </span>
                <span className="font-mono text-sm text-white w-24 shrink-0">{run.distanceKm.toFixed(2)} km</span>
                <span className="font-mono text-sm text-white w-24 shrink-0">{run.avgPaceSecKm > 0 ? formatPace(run.avgPaceSecKm) + "/km" : "—"}</span>
                <span className="font-mono text-sm text-white w-20 shrink-0 hidden md:block">{formatDuration(run.durationSecs)}</span>
                <span className="text-xs font-mono w-28 shrink-0 hidden md:block" style={{ color: "var(--text-muted)" }}>{formatDateAest(run.dateIso)}</span>
                <button
                  type="button"
                  className="text-base font-black font-mono tabular-nums w-16 shrink-0 min-w-[60px] text-right rounded px-0.5 -mx-0.5 hover:underline underline-offset-2 disabled:opacity-50 disabled:no-underline transition-colors duration-150"
                  style={{ color: run.rating != null ? ratingColor(run.rating) : "var(--text-muted)" }}
                  disabled={run.rating == null}
                  aria-expanded={ratingOpen}
                  aria-label={run.rating != null ? "Toggle rating breakdown" : "No rating"}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (run.rating != null) toggleRatingBreakdown(run.id);
                  }}
                >
                  {run.rating != null ? (
                    <div className="relative group cursor-default inline-block">
                      {run.rating.toFixed(1)}
                      <div
                        className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 rounded-lg text-xs font-semibold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10"
                        style={{ background: "#1a1a1a", color: ratingColor(run.rating) }}
                      >
                        {ratingBand(run.rating)}
                      </div>
                    </div>
                  ) : "—"}
                </button>
              </div>

              {ratingOpen && run.rating != null && (
                <div
                  className="px-4 pt-2 pb-4 border-b border-white/[0.06] bg-white/[0.02]"
                  style={{
                    borderTop: "1px solid rgba(255,255,255,0.04)",
                  }}
                >
                  <RatingBreakdownPanel json={run.ratingBreakdown} rating={run.rating} />
                </div>
              )}

              {/* Expanded detail */}
              {isOpen && (
                <div
                  className="px-4 pb-4 pt-1 grid grid-cols-2 gap-x-8 gap-y-2 text-xs"
                  style={{
                    borderTop: "1px solid rgba(255,255,255,0.04)",
                    background: "rgba(255,255,255,0.02)",
                  }}
                >
                  <div className="col-span-2 flex gap-2 mb-1">
                    <a
                      href={`https://www.strava.com/activities/${run.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold mt-3 transition-colors"
                      style={{
                        background: "rgba(249,115,22,0.12)",
                        border: "1px solid rgba(249,115,22,0.25)",
                        color: "#f97316",
                      }}
                    >
                      View on Strava
                    </a>
                  </div>
                  <div className="col-span-2 grid grid-cols-3 gap-3 mt-3 pt-3 border-t border-white/[0.06]">
                    {[
                    ["Avg HR",      run.avgHeartRate ? `${run.avgHeartRate} bpm` : "—"],
                    ["Max HR",      run.maxHeartRate ? `${run.maxHeartRate} bpm` : "—"],
                    ["Calories",    run.calories     ? `${run.calories} kcal`   : "—"],
                    ["Elevation",   run.elevationGainM != null ? `+${run.elevationGainM.toFixed(0)} m` : "—"],
                    ["Temp",        run.temperatureC != null ? `${run.temperatureC.toFixed(1)}°C`  : "—"],
                    ["Humidity",    run.humidityPct  != null ? `${run.humidityPct.toFixed(0)}%`    : "—"],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <p className="text-xs" style={{ color: "var(--text-dim)" }}>{label}</p>
                      <p className="text-sm font-mono font-semibold text-white">{value}</p>
                    </div>
                  ))}
                  </div>
                  <div className="col-span-2 mt-3 pt-3 border-t border-white/[0.06] flex items-center gap-2 text-xs" style={{ color: "var(--text-muted)" }}>
                    <span>Classified by:</span>
                    <span>{run.classificationMethod ?? "Average pace classification (legacy activity)"}</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Mobile cards ─────────────────────────────────────────────── */}
      <div className="md:hidden space-y-3">
        {!loading && runs.length === 0 && (
          <div className="rounded-2xl border bg-white/[0.04] border-white/[0.08] backdrop-blur-sm">
            <EmptyState
              icon={<Activity className="w-7 h-7" style={{ color: "var(--accent)" }} />}
              title="No runs yet"
              body="Connect Strava and your runs will appear here automatically after each sync."
              action={{ label: "Sync Strava", onClick: handleSync }}
            />
          </div>
        )}
        {runs.map((run) => {
          const isOpen = expanded.has(run.id);
          const ratingOpen = ratingBreakdownOpen.has(run.id);
          return (
            <div
              key={run.id}
              className="rounded-2xl border bg-white/[0.04] border-white/[0.08] backdrop-blur-sm overflow-hidden transition-all duration-150 hover:brightness-105 hover:scale-[1.005] active:scale-[0.998]"
            >
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-left min-h-11"
                    onClick={() => toggleExpand(run.id)}
                  >
                    <p className="text-sm text-white font-medium break-words">{run.name ?? "Run"}</p>
                    <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                      {formatDateAest(run.dateIso)}
                    </p>
                    <div className="mt-2">
                      <RunTypePill type={run.runType} size="sm" />
                    </div>
                  </button>
                  <button
                    type="button"
                    className="text-lg font-bold shrink-0 tabular-nums min-h-11 min-w-[3rem] text-right rounded px-1 -mr-1 hover:underline underline-offset-2 disabled:opacity-50 disabled:no-underline"
                    style={{ color: run.rating != null ? ratingColor(run.rating) : "var(--text-muted)" }}
                    disabled={run.rating == null}
                    aria-expanded={ratingOpen}
                    aria-label={run.rating != null ? "Toggle rating breakdown" : "No rating"}
                    onClick={() => {
                      if (run.rating != null) toggleRatingBreakdown(run.id);
                    }}
                  >
                    {run.rating != null ? run.rating.toFixed(1) : "—"}
                  </button>
                </div>
                <button
                  type="button"
                  className="w-full text-left grid grid-cols-3 gap-2 mt-3 text-xs min-h-11"
                  onClick={() => toggleExpand(run.id)}
                >
                  <div>
                    <p style={{ color: "var(--text-muted)" }}>Distance</p>
                    <p className="text-white font-medium tabular-nums">{run.distanceKm.toFixed(2)} km</p>
                  </div>
                  <div>
                    <p style={{ color: "var(--text-muted)" }}>Pace</p>
                    <p className="text-white font-medium tabular-nums">
                      {run.avgPaceSecKm > 0 ? formatPace(run.avgPaceSecKm) : "—"}
                    </p>
                  </div>
                  <div>
                    <p style={{ color: "var(--text-muted)" }}>Time</p>
                    <p className="text-white font-medium tabular-nums">{formatDuration(run.durationSecs)}</p>
                  </div>
                </button>
                <p className="text-[11px] mt-2" style={{ color: "rgba(156,163,175,0.5)" }}>
                  {isOpen ? "Tap to collapse details" : "Tap run or stats for details"}
                </p>
              </div>
              {ratingOpen && run.rating != null && (
                <div
                  className="px-4 pb-3 pt-1 border-t"
                  style={{
                    borderColor: "rgba(255,255,255,0.06)",
                    background: "rgba(255,255,255,0.02)",
                  }}
                >
                  <RatingBreakdownPanel json={run.ratingBreakdown} rating={run.rating} />
                </div>
              )}
              {isOpen && (
                <div
                  className="px-4 pb-4 pt-1 grid grid-cols-1 gap-x-8 gap-y-2 text-xs border-t"
                  style={{
                    borderColor: "rgba(255,255,255,0.06)",
                    background: "rgba(255,255,255,0.02)",
                  }}
                >
                  <div className="flex flex-wrap gap-2 mb-1">
                    <a
                      href={`https://www.strava.com/activities/${run.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs min-h-11 px-3 inline-flex items-center rounded-md"
                      style={{ background: "#FC4C0233", color: "#FC4C02", border: "1px solid #FC4C0244" }}
                    >
                      View on Strava
                    </a>
                  </div>
                  {[
                    ["Avg HR",      run.avgHeartRate ? `${run.avgHeartRate} bpm` : "—"],
                    ["Max HR",      run.maxHeartRate ? `${run.maxHeartRate} bpm` : "—"],
                    ["Calories",    run.calories     ? `${run.calories} kcal`   : "—"],
                    ["Elevation",   run.elevationGainM != null ? `+${run.elevationGainM.toFixed(0)} m` : "—"],
                    ["Temp",        run.temperatureC != null ? `${run.temperatureC.toFixed(1)}°C`  : "—"],
                    ["Humidity",    run.humidityPct  != null ? `${run.humidityPct.toFixed(0)}%`    : "—"],
                  ].map(([label, value]) => (
                    <div key={label} className="flex justify-between gap-2">
                      <span style={{ color: "var(--text-muted)" }}>{label}</span>
                      <span className="text-white text-right">{value}</span>
                    </div>
                  ))}
                  <div
                    className="mt-2 rounded-md px-3 py-2.5 space-y-1 col-span-1"
                    style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
                  >
                    <p className="text-[10px] uppercase tracking-wider mb-1.5" style={{ color: "var(--text-muted)" }}>
                      Type classification
                    </p>
                    <p className="text-xs text-white flex items-center gap-2">
                      Classified as: <RunTypePill type={run.runType} size="sm" />
                    </p>
                    <p className="text-xs" style={{ color: "rgba(255,255,255,0.7)" }}>
                      Classified by: {run.classificationMethod ?? "Average pace classification (legacy activity)"}
                    </p>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Pagination ─────────────────────────────────────────────────── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-1">
          <button
            type="button"
            onClick={() => fetchRuns(page - 1)}
            disabled={page <= 1 || loading}
            className="min-h-11 px-4 py-2 rounded-md text-sm"
            style={{
              background: "rgba(255,255,255,0.06)",
              color: page <= 1 ? "var(--text-muted)" : "var(--text)",
              border: "1px solid rgba(255,255,255,0.1)",
            }}
          >
            Prev
          </button>
          <span className="text-sm" style={{ color: "var(--text-muted)" }}>
            {page} / {totalPages}
          </span>
          <button
            type="button"
            onClick={() => fetchRuns(page + 1)}
            disabled={page >= totalPages || loading}
            className="min-h-11 px-4 py-2 rounded-md text-sm"
            style={{
              background: "rgba(255,255,255,0.06)",
              color: page >= totalPages ? "var(--text-muted)" : "var(--text)",
              border: "1px solid rgba(255,255,255,0.1)",
            }}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
