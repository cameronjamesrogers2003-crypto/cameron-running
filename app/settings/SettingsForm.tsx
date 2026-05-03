"use client";

import { useState } from "react";
import { useSettings } from "@/context/SettingsContext";
import { formatPace, parsePace, formatDuration, parseDuration } from "@/lib/settings";
import { getVdotPaces } from "@/lib/vdot";

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
      onClick={onClick}
      disabled={status === "saving"}
      className="px-4 py-1.5 rounded-md text-sm font-medium transition-colors"
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
    <div className="flex items-center gap-4">
      <div className="w-48 shrink-0">
        <p className="text-sm text-white">{label}</p>
        {hint && <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{hint}</p>}
      </div>
      <div className="flex-1">{children}</div>
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
      className="w-full rounded-md px-3 py-1.5 text-sm text-white outline-none focus:ring-1"
      style={{
        background: "rgba(255,255,255,0.06)",
        border: "1px solid rgba(255,255,255,0.1)",
        maxWidth: 220,
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
      className="w-24 rounded-md px-3 py-1.5 text-sm text-white outline-none focus:ring-1"
      style={{
        background: "rgba(255,255,255,0.06)",
        border: "1px solid rgba(255,255,255,0.1)",
      }}
    />
  );
}

export default function SettingsForm() {
  const { settings, updateSettings } = useSettings();

  // ── Training Plan group ────────────────────────────────────────────────────
  const [planStartDate,       setPlanStartDate]       = useState(settings.planStartDate?.slice(0, 10) ?? "");
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

  // ── Distance targets group ────────────────────────────────────────────────
  const [distEasy,     setDistEasy]     = useState(settings.distTargetEasyM / 1000);
  const [distTempo,    setDistTempo]    = useState(settings.distTargetTempoM / 1000);
  const [distInterval, setDistInterval] = useState(settings.distTargetIntervalM / 1000);
  const [distLong,     setDistLong]     = useState(settings.distTargetLongM / 1000);
  const distGroup = useSaveGroup();

  return (
    <div className="space-y-5 max-w-2xl">
      {/* Training Plan */}
      <Panel title="Training Plan">
        <Field label="Plan start date" hint="AEST date plan begins">
          <TextInput value={planStartDate} onChange={setPlanStartDate} placeholder="YYYY-MM-DD" />
        </Field>
        <Field label="Week override" hint="Force a specific week number">
          <TextInput
            value={currentWeekOverride}
            onChange={setCurrentWeekOverride}
            placeholder="Auto"
          />
        </Field>
        <div className="flex justify-end pt-1">
          <SaveButton
            status={planGroup.status}
            onClick={() =>
              planGroup.save(() =>
                updateSettings({
                  planStartDate:       planStartDate || null,
                  currentWeekOverride: currentWeekOverride ? parseInt(currentWeekOverride, 10) : null,
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
          <div className="flex items-center gap-3">
            <NumberInput value={vdot} onChange={setVdot} min={28} max={60} />
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              Easy {formatPace(vdotPaces.easyMaxSecKm)} · Tempo {formatPace(vdotPaces.tempoSecKm)} · Interval {formatPace(vdotPaces.intervalSecKm)} /km
            </span>
          </div>
        </Field>
        <Field label="Starting tempo pace" hint="min/km at plan start">
          <TextInput value={startTP} onChange={setStartTP} placeholder="6:30" />
        </Field>
        <div className="flex justify-end pt-1">
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
          <div className="flex items-center gap-3">
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
        <div className="flex justify-end pt-1">
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
        <div className="flex justify-end pt-1">
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
    </div>
  );
}
