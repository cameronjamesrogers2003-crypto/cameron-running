"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { RatingResult } from "@/lib/rating";
import type { RunType } from "@/data/trainingPlan";
import { formatPace, formatDuration } from "@/lib/settings";

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
  rating: RatingResult | null;
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
  if (score >= 8.5) return "#AFA9EC";
  if (score >= 7)   return "#5DCAA5";
  if (score >= 5.5) return "#85B7EB";
  if (score >= 4)   return "#EF9F27";
  return "#F09595";
}

function Pill({ type }: { type: RunType }) {
  return (
    <span
      className="px-2 py-0.5 rounded text-xs font-medium capitalize"
      style={{
        background: `${TYPE_COLORS[type]}22`,
        color: TYPE_COLORS[type],
        border: `1px solid ${TYPE_COLORS[type]}44`,
      }}
    >
      {type}
    </span>
  );
}

function SortIcon({ active, dir }: { active: boolean; dir: "asc" | "desc" }) {
  return (
    <span className="ml-1 inline-block" style={{ opacity: active ? 1 : 0.3 }}>
      {dir === "asc" ? "↑" : "↓"}
    </span>
  );
}

export default function RunsClient() {
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

  // Expanded rows
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

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

  function formatDateAest(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleDateString("en-AU", {
      timeZone: "Australia/Brisbane",
      day: "numeric", month: "short", year: "numeric",
    });
  }

  return (
    <div className="space-y-4">
      {/* ── Filter panel ───────────────────────────────────────────────── */}
      <div
        className="rounded-[10px] p-4 space-y-3"
        style={{ background: "#181818", border: "1px solid rgba(255,255,255,0.08)" }}
      >
        {/* Search */}
        <input
          type="text"
          placeholder="Search by name…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full rounded-md px-3 py-1.5 text-sm text-white outline-none"
          style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
        />

        <div className="flex flex-wrap gap-3 items-center">
          {/* Type pills */}
          <div className="flex gap-1.5">
            {RUN_TYPES.map(t => (
              <button
                key={t}
                onClick={() => toggleType(t)}
                className="px-3 py-1 rounded-full text-xs font-medium capitalize transition-all"
                style={{
                  background: types.includes(t) ? `${TYPE_COLORS[t]}33` : "rgba(255,255,255,0.06)",
                  color: types.includes(t) ? TYPE_COLORS[t] : "var(--text-muted)",
                  border: `1px solid ${types.includes(t) ? TYPE_COLORS[t] + "66" : "rgba(255,255,255,0.1)"}`,
                }}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Date range */}
          <div className="flex items-center gap-1.5">
            <input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              className="rounded-md px-2 py-1 text-xs text-white outline-none"
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
            />
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>to</span>
            <input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              className="rounded-md px-2 py-1 text-xs text-white outline-none"
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
            />
          </div>

          {/* Distance range */}
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              placeholder="Dist ≥"
              value={distMin}
              onChange={e => setDistMin(e.target.value)}
              className="w-20 rounded-md px-2 py-1 text-xs text-white outline-none"
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
            />
            <input
              type="number"
              placeholder="≤ km"
              value={distMax}
              onChange={e => setDistMax(e.target.value)}
              className="w-20 rounded-md px-2 py-1 text-xs text-white outline-none"
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
            />
          </div>

          {/* Clear */}
          {(search || types.length || dateFrom || dateTo || distMin || distMax) && (
            <button
              onClick={() => { setSearch(""); setTypes([]); setDateFrom(""); setDateTo(""); setDistMin(""); setDistMax(""); }}
              className="text-xs px-2 py-1 rounded-md"
              style={{ color: "var(--text-muted)", background: "rgba(255,255,255,0.04)" }}
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* ── Results count ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          {loading ? "Loading…" : `${total} run${total !== 1 ? "s" : ""}`}
        </p>
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          Page {page} of {totalPages}
        </p>
      </div>

      {/* ── Table ──────────────────────────────────────────────────────── */}
      <div
        className="rounded-[10px] overflow-hidden"
        style={{ border: "1px solid rgba(255,255,255,0.08)" }}
      >
        {/* Header */}
        <div
          className="grid text-xs font-medium px-4 py-2"
          style={{
            gridTemplateColumns: "1fr 100px 80px 80px 70px 70px 60px",
            background: "#111",
            color: "var(--text-muted)",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
          }}
        >
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
              onClick={() => field && toggleSort(field)}
              className="text-left"
              style={{ cursor: field ? "pointer" : "default" }}
            >
              {label}
              {field && <SortIcon active={sortBy === field} dir={order} />}
            </button>
          ))}
        </div>

        {/* Rows */}
        {!loading && runs.length === 0 && (
          <div className="px-4 py-8 text-center text-sm" style={{ color: "var(--text-muted)" }}>
            No runs match the current filters.
          </div>
        )}

        {runs.map((run, i) => {
          const isOpen = expanded.has(run.id);
          return (
            <div key={run.id}>
              <button
                className="w-full grid px-4 py-3 text-left transition-colors hover:bg-white/[0.03]"
                style={{
                  gridTemplateColumns: "1fr 100px 80px 80px 70px 70px 60px",
                  borderTop: i > 0 ? "1px solid rgba(255,255,255,0.04)" : undefined,
                  alignItems: "center",
                }}
                onClick={() => toggleExpand(run.id)}
              >
                <span className="text-sm text-white truncate pr-2">{run.name ?? "Run"}</span>
                <span><Pill type={run.runType} /></span>
                <span className="text-sm text-white">{run.distanceKm.toFixed(2)} km</span>
                <span className="text-sm text-white">{run.avgPaceSecKm > 0 ? formatPace(run.avgPaceSecKm) + "/km" : "—"}</span>
                <span className="text-sm" style={{ color: "var(--text-muted)" }}>{formatDuration(run.durationSecs)}</span>
                <span className="text-sm" style={{ color: "var(--text-muted)" }}>{formatDateAest(run.dateIso)}</span>
                <span
                  className="text-sm font-semibold"
                  style={{ color: run.rating ? ratingColor(run.rating.total) : "var(--text-muted)" }}
                >
                  {run.rating ? run.rating.total.toFixed(1) : "—"}
                </span>
              </button>

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
                      className="text-xs px-3 py-1 rounded-md"
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
                    <div key={label} className="flex justify-between">
                      <span style={{ color: "var(--text-muted)" }}>{label}</span>
                      <span className="text-white">{value}</span>
                    </div>
                  ))}
                  {run.rating && (
                    <>
                      <div className="flex justify-between">
                        <span style={{ color: "var(--text-muted)" }}>Pace score</span>
                        <span className="text-white">{run.rating.pace.toFixed(1)}/2.5</span>
                      </div>
                      <div className="flex justify-between">
                        <span style={{ color: "var(--text-muted)" }}>Effort score</span>
                        <span className="text-white">{run.rating.effort.toFixed(1)}/2.5</span>
                      </div>
                      <div className="flex justify-between">
                        <span style={{ color: "var(--text-muted)" }}>Dist score</span>
                        <span className="text-white">{run.rating.distance.toFixed(1)}/2.5</span>
                      </div>
                      <div className="flex justify-between">
                        <span style={{ color: "var(--text-muted)" }}>Conditions</span>
                        <span className="text-white">{run.rating.conditions.toFixed(1)}/2.5</span>
                      </div>
                    </>
                  )}
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
            onClick={() => fetchRuns(page - 1)}
            disabled={page <= 1 || loading}
            className="px-3 py-1.5 rounded-md text-sm"
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
            onClick={() => fetchRuns(page + 1)}
            disabled={page >= totalPages || loading}
            className="px-3 py-1.5 rounded-md text-sm"
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
