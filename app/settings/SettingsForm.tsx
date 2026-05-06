"use client";

import { useState, useEffect } from "react";
import { useSettings } from "@/context/SettingsContext";
import { brisbaneMidnightUtcForYmd } from "@/lib/dateUtils";
import { planStartAusDisplayToIsoYmd, planStartIsoYmdToAusDisplay } from "@/lib/planStartDateFormat";
import { formatPace, parsePace, formatDuration, parseDuration } from "@/lib/settings";
import { getVdotPaces } from "@/lib/vdot";
import type { Day, PlanConfig, RunType } from "@/data/trainingPlan";
import { recommendSessionAssignment, hasConsecutiveHardDays } from "@/lib/generatePlan";
import InterruptionsForm from "./InterruptionsForm";

type SaveStatus = "idle" | "saving" | "saved" | "error";

function useSaveGroup() {
  const [status, setStatus] = useState<SaveStatus>("idle");
  return {
    status,
    async save(fn: () => Promise<void>) {
      setStatus("saving");
      try {
        await fn();
        setStatus("saved");
        setTimeout(() => setStatus("idle"), 2500);
      } catch {
        setStatus("error");
        setTimeout(() => setStatus("idle"), 3000);
      }
    },
  };
}

function SaveButton({ status, onClick }: { status: SaveStatus; onClick: () => void }) {
  const label = status === "saving" ? "Saving…" : status === "saved" ? "Saved" : status === "error" ? "Error" : "Save";
  const color =
    status === "saved"  ? "#5DCAA5" :
    status === "error"  ? "#F09595" :
    status === "saving" ? "var(--text-muted)" :
    "var(--accent)";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={status === "saving"}
      className="min-h-11 px-4 py-2 rounded-md text-sm font-medium transition-colors w-full sm:w-auto"
      style={{ background: "rgba(255,255,255,0.06)", color, border: "1px solid rgba(255,255,255,0.1)" }}
    >
      {label}
    </button>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      className="rounded-[10px] p-5 space-y-4"
      style={{ background: "#181818", border: "1px solid rgba(255,255,255,0.08)" }}
    >
      <p className="text-xs uppercase tracking-wider font-semibold" style={{ color: "var(--text-muted)" }}>
        {title}
      </p>
      {children}
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-4">
      <div className="w-full sm:w-48 shrink-0">
        <p className="text-sm text-white">{label}</p>
        {hint && <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{hint}</p>}
      </div>
      <div className="flex-1 w-full min-w-0">{children}</div>
    </div>
  );
}

function TextInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <input
      type="text"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full max-w-full sm:max-w-xs rounded-md px-3 py-2 min-h-11 text-sm text-white outline-none focus:ring-1"
      style={{
        background: "rgba(255,255,255,0.06)",
        border: "1px solid rgba(255,255,255,0.1)",
      }}
    />
  );
}

function NumberInput({ value, onChange, min, max }: { value: number | string; onChange: (v: number) => void; min?: number; max?: number }) {
  return (
    <input
      type="number"
      value={value}
      onChange={e => onChange(Number(e.target.value))}
      min={min}
      max={max}
      className="w-full sm:w-24 rounded-md px-3 py-2 min-h-11 text-sm text-white outline-none focus:ring-1"
      style={{
        background: "rgba(255,255,255,0.06)",
        border: "1px solid rgba(255,255,255,0.1)",
      }}
    />
  );
}

function PaceInput({ value, onChange, placeholder = "0:00" }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <input
      type="text"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full max-w-[5.5rem] sm:w-16 rounded-md px-2 py-2 min-h-11 text-sm text-white outline-none focus:ring-1 text-center"
      style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
    />
  );
}

type ZoneSuggestion = {
  type: "easy" | "tempo" | "interval" | "long";
  avgPace: number;
  midpoint: number;
  newMin: number;
  newMax: number;
};

export default function SettingsForm() {
  const { settings, updateSettings } = useSettings();

  // ── Training Plan group ────────────────────────────────────────────────────
  const [planStartDate,       setPlanStartDate]       = useState(
    () => planStartIsoYmdToAusDisplay(settings.planStartDate),
  );
  const [currentWeekOverride, setCurrentWeekOverride] = useState(String(settings.currentWeekOverride ?? ""));
  const planGroup = useSaveGroup();

  // ── Performance group ─────────────────────────────────────────────────────
  const [maxHR,   setMaxHR]   = useState(settings.maxHR);
  const [vdot,    setVdot]    = useState(settings.currentVdot);
  const [startTP, setStartTP] = useState(formatPace(settings.startingTempoPaceSec));
  const perfGroup = useSaveGroup();

  const vdotPaces = getVdotPaces(vdot);

  // ── HM Goal group ─────────────────────────────────────────────────────────
  const [hmTime,    setHmTime]    = useState(formatDuration(settings.targetHMTimeSec));
  const [raceName,  setRaceName]  = useState(settings.raceName ?? "");
  const [raceDate,  setRaceDate]  = useState(settings.raceDate?.slice(0, 10) ?? "");
  const hmGroup = useSaveGroup();

  const hmPacePreview = (() => {
    const secs = parseDuration(hmTime);
    if (!secs) return null;
    const perKm = secs / 21.0975;
    return formatPace(perKm);
  })();

  // ── Pace zones group ─────────────────────────────────────────────────────
  const [easyMin,     setEasyMin]     = useState(formatPace(settings.easyPaceMinSec));
  const [easyMax,     setEasyMax]     = useState(formatPace(settings.easyPaceMaxSec));
  const [tempoMin,    setTempoMin]    = useState(formatPace(settings.tempoPaceMinSec));
  const [tempoMax,    setTempoMax]    = useState(formatPace(settings.tempoPaceMaxSec));
  const [intervalMin, setIntervalMin] = useState(formatPace(settings.intervalPaceMinSec));
  const [intervalMax, setIntervalMax] = useState(formatPace(settings.intervalPaceMaxSec));
  const [longMin,     setLongMin]     = useState(formatPace(settings.longPaceMinSec));
  const [longMax,     setLongMax]     = useState(formatPace(settings.longPaceMaxSec));
  const zonesGroup = useSaveGroup();

  const [suggestions, setSuggestions] = useState<ZoneSuggestion[]>([]);

  useEffect(() => {
    fetch("/api/runs?perPage=100&sort=date&order=desc")
      .then(r => r.json())
      .then((data: { data: Array<{ avgPaceSecKm: number; runType: string }> }) => {
        const byType: Record<string, number[]> = { easy: [], tempo: [], interval: [], long: [] };
        for (const run of data.data) {
          if (run.avgPaceSecKm > 0 && run.runType in byType) {
            byType[run.runType].push(run.avgPaceSecKm);
          }
        }
        const zoneConfigs: Array<{
          type: ZoneSuggestion["type"];
          minSec: number;
          maxSec: number;
        }> = [
          { type: "easy",     minSec: settings.easyPaceMinSec,     maxSec: settings.easyPaceMaxSec },
          { type: "tempo",    minSec: settings.tempoPaceMinSec,    maxSec: settings.tempoPaceMaxSec },
          { type: "interval", minSec: settings.intervalPaceMinSec, maxSec: settings.intervalPaceMaxSec },
          { type: "long",     minSec: settings.longPaceMinSec,     maxSec: settings.longPaceMaxSec },
        ];
        const sug: ZoneSuggestion[] = [];
        for (const zc of zoneConfigs) {
          const paces = byType[zc.type].slice(0, 8);
          if (!paces.length) continue;
          const avgPace  = Math.round(paces.reduce((s, p) => s + p, 0) / paces.length);
          const midpoint = (zc.minSec + zc.maxSec) / 2;
          const width    = zc.maxSec - zc.minSec;
          if (midpoint - avgPace > 15) {
            const newMin = Math.round((avgPace - width / 2) / 5) * 5;
            const newMax = Math.round((avgPace + width / 2) / 5) * 5;
            sug.push({ type: zc.type, avgPace, midpoint, newMin, newMax });
          }
        }
        setSuggestions(sug);
      })
      .catch(() => {});
  }, [settings]);

  useEffect(() => {
    setPlanStartDate(planStartIsoYmdToAusDisplay(settings.planStartDate));
  }, [settings.planStartDate]);

  function applySuggestion(sug: ZoneSuggestion) {
    const mn = formatPace(sug.newMin);
    const mx = formatPace(sug.newMax);
    if (sug.type === "easy")     { setEasyMin(mn);     setEasyMax(mx); }
    if (sug.type === "tempo")    { setTempoMin(mn);    setTempoMax(mx); }
    if (sug.type === "interval") { setIntervalMin(mn); setIntervalMax(mx); }
    if (sug.type === "long")     { setLongMin(mn);     setLongMax(mx); }
  }

  // ── Distance targets group ────────────────────────────────────────────────
  const [distEasy,     setDistEasy]     = useState(settings.distTargetEasyM / 1000);
  const [distTempo,    setDistTempo]    = useState(settings.distTargetTempoM / 1000);
  const [distInterval, setDistInterval] = useState(settings.distTargetIntervalM / 1000);
  const [distLong,     setDistLong]     = useState(settings.distTargetLongM / 1000);
  const distGroup = useSaveGroup();

  return (
    <div className="space-y-5 w-full max-w-2xl min-w-0">
      {/* Training Plan */}
      <Panel title="Training Plan">
        <Field label="Plan start date" hint="First day your program counts (Brisbane calendar)">
          <TextInput value={planStartDate} onChange={setPlanStartDate} placeholder="DD/MM/YYYY" />
        </Field>
        <Field label="Week override" hint="Force a specific week number">
          <TextInput
            value={currentWeekOverride}
            onChange={setCurrentWeekOverride}
            placeholder="Auto"
          />
        </Field>
        <div className="flex justify-stretch sm:justify-end pt-1">
          <SaveButton
            status={planGroup.status}
            onClick={() =>
              planGroup.save(async () => {
                const trimmed = planStartDate.trim();
                let planIso: string | null = null;
                if (trimmed) {
                  const isoYmd = planStartAusDisplayToIsoYmd(planStartDate);
                  if (!isoYmd) throw new Error("Invalid plan start date (use DD/MM/YYYY)");
                  planIso = brisbaneMidnightUtcForYmd(isoYmd).toISOString();
                }
                await updateSettings({
                  planStartDate: planIso,
                  currentWeekOverride: currentWeekOverride ? parseInt(currentWeekOverride, 10) : null,
                });
              })
            }
          />
        </div>
      </Panel>

      {/* My Pace Zones */}
      <Panel title="My Pace Zones">
        <div className="space-y-4">
          {([
            {
              label: "Easy",
              min: easyMin, setMin: setEasyMin,
              max: easyMax, setMax: setEasyMax,
              hint: "Your comfortable conversational pace.",
              vdotRef: `${formatPace(vdotPaces.easyMinSecKm)}–${formatPace(vdotPaces.easyMaxSecKm)}`,
            },
            {
              label: "Tempo",
              min: tempoMin, setMin: setTempoMin,
              max: tempoMax, setMax: setTempoMax,
              hint: "Controlled hard effort — comfortably uncomfortable.",
              vdotRef: formatPace(vdotPaces.tempoSecKm),
            },
            {
              label: "Interval",
              min: intervalMin, setMin: setIntervalMin,
              max: intervalMax, setMax: setIntervalMax,
              hint: "Hard rep pace — 9/10 effort.",
              vdotRef: formatPace(vdotPaces.intervalSecKm),
            },
            {
              label: "Long",
              min: longMin, setMin: setLongMin,
              max: longMax, setMax: setLongMax,
              hint: "Easy effort sustained over distance — same as easy pace.",
              vdotRef: `${formatPace(vdotPaces.easyMinSecKm)}–${formatPace(vdotPaces.easyMaxSecKm)}`,
            },
          ] as Array<{
            label: string;
            min: string; setMin: (v: string) => void;
            max: string; setMax: (v: string) => void;
            hint: string;
            vdotRef: string;
          }>).map(({ label, min, setMin, max, setMax, hint, vdotRef }) => (
            <div key={label}>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:flex-wrap">
                <span className="text-sm text-white sm:w-16 shrink-0">{label}</span>
                <div className="flex items-center gap-2 flex-wrap">
                  <PaceInput value={min} onChange={setMin} />
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>to</span>
                  <PaceInput value={max} onChange={setMax} />
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>/km</span>
                </div>
                <span className="text-[11px] sm:ml-0" style={{ color: "rgba(156,163,175,0.4)" }}>
                  VDOT target: {vdotRef} /km
                </span>
              </div>
              <p className="text-xs mt-1 sm:ml-20" style={{ color: "var(--text-muted)" }}>{hint}</p>
            </div>
          ))}
        </div>

        {/* Suggested updates */}
        {suggestions.length > 0 && (
          <div
            className="rounded-[8px] p-4 space-y-3 mt-2"
            style={{ background: "rgba(167,139,250,0.06)", border: "1px solid rgba(167,139,250,0.15)" }}
          >
            <p className="text-xs uppercase tracking-wider font-semibold" style={{ color: "#a78bfa" }}>
              Suggested Updates
            </p>
            {suggestions.map(sug => (
              <div key={sug.type} className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                <p className="text-xs flex-1 min-w-0" style={{ color: "var(--text-muted)" }}>
                  Your recent <span className="text-white">{sug.type}</span> runs average{" "}
                  <span className="text-white">{formatPace(sug.avgPace)}/km</span> — faster than your current{" "}
                  {sug.type} zone midpoint of {formatPace(sug.midpoint)}/km.{" "}
                  Consider updating to{" "}
                  <span className="text-white">{formatPace(sug.newMin)}–{formatPace(sug.newMax)} /km</span>.
                </p>
                <button
                  type="button"
                  onClick={() => applySuggestion(sug)}
                  className="shrink-0 min-h-11 px-3 py-2 rounded-md text-xs font-medium w-full sm:w-auto"
                  style={{ background: "rgba(167,139,250,0.12)", color: "#a78bfa", border: "1px solid rgba(167,139,250,0.2)" }}
                >
                  Apply
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex justify-stretch sm:justify-end pt-1">
          <SaveButton
            status={zonesGroup.status}
            onClick={() =>
              zonesGroup.save(() =>
                updateSettings({
                  easyPaceMinSec:      parsePace(easyMin)     ?? settings.easyPaceMinSec,
                  easyPaceMaxSec:      parsePace(easyMax)     ?? settings.easyPaceMaxSec,
                  tempoPaceMinSec:     parsePace(tempoMin)    ?? settings.tempoPaceMinSec,
                  tempoPaceMaxSec:     parsePace(tempoMax)    ?? settings.tempoPaceMaxSec,
                  intervalPaceMinSec:  parsePace(intervalMin) ?? settings.intervalPaceMinSec,
                  intervalPaceMaxSec:  parsePace(intervalMax) ?? settings.intervalPaceMaxSec,
                  longPaceMinSec:      parsePace(longMin)     ?? settings.longPaceMinSec,
                  longPaceMaxSec:      parsePace(longMax)     ?? settings.longPaceMaxSec,
                })
              )
            }
          />
        </div>
      </Panel>

      {/* Performance Constants */}
      <Panel title="Performance Constants">
        <Field label="Max heart rate" hint="bpm">
          <NumberInput value={maxHR} onChange={setMaxHR} min={140} max={220} />
        </Field>
        <Field label="Current VDOT" hint="Jack Daniels (28–60)">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
            <NumberInput value={vdot} onChange={setVdot} min={28} max={60} />
            <span className="text-xs break-words" style={{ color: "var(--text-muted)" }}>
              Easy {formatPace(vdotPaces.easyMaxSecKm)} · Tempo {formatPace(vdotPaces.tempoSecKm)} · Interval {formatPace(vdotPaces.intervalSecKm)} /km
            </span>
          </div>
        </Field>
        <Field label="Starting tempo pace" hint="min/km at plan start">
          <TextInput value={startTP} onChange={setStartTP} placeholder="6:30" />
        </Field>
        <div className="flex justify-stretch sm:justify-end pt-1">
          <SaveButton
            status={perfGroup.status}
            onClick={() => {
              const parsedPace = parsePace(startTP);
              return perfGroup.save(() =>
                updateSettings({
                  maxHR,
                  currentVdot: vdot,
                  ...(parsedPace != null ? { startingTempoPaceSec: parsedPace } : {}),
                })
              );
            }}
          />
        </div>
      </Panel>

      {/* HM Goal */}
      <Panel title="Half Marathon Goal">
        <Field label="Target time" hint="H:MM:SS">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
            <TextInput value={hmTime} onChange={setHmTime} placeholder="1:55:00" />
            {hmPacePreview && (
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                = {hmPacePreview}/km pace
              </span>
            )}
          </div>
        </Field>
        <Field label="Race name">
          <TextInput value={raceName} onChange={setRaceName} placeholder="Gold Coast HM" />
        </Field>
        <Field label="Race date" hint="AEST date">
          <TextInput value={raceDate} onChange={setRaceDate} placeholder="YYYY-MM-DD" />
        </Field>
        <div className="flex justify-stretch sm:justify-end pt-1">
          <SaveButton
            status={hmGroup.status}
            onClick={() => {
              const secs = parseDuration(hmTime);
              return hmGroup.save(() =>
                updateSettings({
                  ...(secs != null ? { targetHMTimeSec: secs } : {}),
                  raceName: raceName || null,
                  raceDate: raceDate || null,
                })
              );
            }}
          />
        </div>
      </Panel>

      {/* Distance Targets */}
      <Panel title="Distance Targets">
        {([
          { label: "Easy run",    value: distEasy,     set: setDistEasy },
          { label: "Tempo run",   value: distTempo,    set: setDistTempo },
          { label: "Interval",    value: distInterval, set: setDistInterval },
          { label: "Long run",    value: distLong,     set: setDistLong },
        ] as Array<{ label: string; value: number; set: (v: number) => void }>).map(({ label, value, set }) => (
          <Field key={label} label={label} hint="km target">
            <NumberInput value={value} onChange={set} min={1} max={50} />
          </Field>
        ))}
        <div className="flex justify-stretch sm:justify-end pt-1">
          <SaveButton
            status={distGroup.status}
            onClick={() =>
              distGroup.save(() =>
                updateSettings({
                  distTargetEasyM:      Math.round(distEasy     * 1000),
                  distTargetTempoM:     Math.round(distTempo    * 1000),
                  distTargetIntervalM:  Math.round(distInterval * 1000),
                  distTargetLongM:      Math.round(distLong     * 1000),
                })
              )
            }
          />
        </div>
      </Panel>

      {/* Plan Interruptions */}
      <InterruptionsForm />
    </div>
  );
}
