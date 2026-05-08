"use client";

import { useEffect, useMemo, useState } from "react";
import { useSettings } from "@/context/SettingsContext";
import { brisbaneMidnightUtcForYmd, toBrisbaneYmd } from "@/lib/dateUtils";
import { planStartIsoYmdToAusDisplay } from "@/lib/planStartDateFormat";
import { type UserSettings } from "@/lib/settings";
import { deriveRatingPaceZones } from "@/lib/planPaces";
import type { Day } from "@/data/trainingPlan";
import { getDefaultLongRunDay, getScheduleWarnings } from "@/lib/generatePlan";
import VdotCalculator, { type VdotPersonalFields } from "@/components/VdotCalculator";
import PaceZoneOffsetSlider from "@/components/PaceZoneOffsetSlider";
import { FORM_CONTROL_TW } from "@/lib/formControlClasses";

type SaveStatus = "idle" | "saving" | "saved" | "error";

function SaveButton({ status, onClick }: { status: SaveStatus; onClick: () => void }) {
  const label =
    status === "saving" ? "Saving..."
    : status === "saved" ? "Saved"
    : status === "error" ? "Error"
    : "Save";
  const isSaving = status === "saving";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isSaving}
      className="px-8 py-3 rounded-xl text-sm font-bold transition-all w-full sm:w-auto hover:bg-[#14b8a6]"
      style={{
        background: "var(--accent)",
        color: "#0a0b0c",
        opacity: isSaving ? 0.7 : 1,
      }}
    >
      {label}
    </button>
  );
}

function Panel({ number, title, children }: { number: string; title: string; children: React.ReactNode }) {
  return (
    <div
      className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6 mb-4 space-y-4"
    >
      <div className="flex items-center gap-3 mb-6">
        <span className="text-xs font-bold tracking-widest uppercase" style={{ color: "var(--accent)" }}>
          {number}
        </span>
        <h2 className="text-base font-bold text-white">{title}</h2>
        <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.08)" }} />
      </div>
      {children}
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-4">
      <div className="w-full sm:w-48 shrink-0">
        <p className="text-sm font-medium text-white mb-2">{label}</p>
        {hint && <p className="text-xs mt-1.5" style={{ color: "var(--text-dim)" }}>{hint}</p>}
      </div>
      <div className="flex-1 w-full min-w-0">{children}</div>
    </div>
  );
}

const DAY_ORDER: Day[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const DAYS: Day[] = DAY_ORDER;
const DAY_LABEL: Record<Day, string> = {
  mon: "Mon",
  tue: "Tue",
  wed: "Wed",
  thu: "Thu",
  fri: "Fri",
  sat: "Sat",
  sun: "Sun",
};

function parseTrainingDaysValue(value: string | null | undefined): Day[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((d): d is Day => DAY_ORDER.includes(d as Day))
      .sort((a, b) => DAY_ORDER.indexOf(a) - DAY_ORDER.indexOf(b));
  } catch {
    return [];
  }
}

function parseLongRunDayValue(value: string | null | undefined): Day | null {
  if (!value) return null;
  return DAY_ORDER.includes(value as Day) ? (value as Day) : null;
}

function buildDraftSettings(
  base: UserSettings,
  patch: Partial<UserSettings>,
): UserSettings {
  return { ...base, ...patch };
}

export default function SettingsForm() {
  const { settings, loading, updateSettings } = useSettings();
  const token = process.env.NEXT_PUBLIC_PLANS_API_TOKEN;
  const authJsonHeaders: Record<string, string> = { "Content-Type": "application/json" };
  if (token) authJsonHeaders.Authorization = `Bearer ${token}`;

  const [planStartDateIsoYmd, setPlanStartDateIsoYmd] = useState(() =>
    settings.planStartDate ? toBrisbaneYmd(new Date(settings.planStartDate)) : ""
  );
  const [experienceLevel, setExperienceLevel] = useState<"BEGINNER" | "INTERMEDIATE" | "ADVANCED">(
    settings.experienceLevel ?? "BEGINNER",
  );
  const [goalRace, setGoalRace] = useState<"HALF" | "FULL">(settings.goalRace ?? "HALF");
  const [planLengthWeeks, setPlanLengthWeeks] = useState<12 | 16 | 20>((settings.planLengthWeeks ?? 16) as 12 | 16 | 20);
  const [trainingDays, setTrainingDays] = useState<Day[]>(() => parseTrainingDaysValue(settings.trainingDays));
  const [selectedLongRunDay, setSelectedLongRunDay] = useState<Day | null>(() => parseLongRunDayValue(settings.longRunDay));

  const [vdotUpdatedMsg, setVdotUpdatedMsg] = useState<string | null>(null);
  const [suggestedLevel, setSuggestedLevel] = useState<"BEGINNER" | "INTERMEDIATE" | "ADVANCED" | null>(null);
  const [showTooManyDaysWarning, setShowTooManyDaysWarning] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");

  const [maxHR, setMaxHR] = useState(settings.maxHR);
  const [vdot, setVdot] = useState(settings.currentVdot);
  const [vdotRaceDistance, setVdotRaceDistance] = useState<string | null>(settings.vdotRaceDistance ?? null);
  const [vdotRaceMinutes, setVdotRaceMinutes] = useState<number | null>(settings.vdotRaceMinutes ?? null);
  const [vdotRaceSeconds, setVdotRaceSeconds] = useState<number | null>(settings.vdotRaceSeconds ?? null);

  const [vdotPersonal, setVdotPersonal] = useState<VdotPersonalFields>({
    ageInput: "",
    gender: "",
    weightInput: "",
    runningExperience: "",
  });

  const [easyOff, setEasyOff] = useState(settings.easyPaceOffsetSec);
  const [tempoOff, setTempoOff] = useState(settings.tempoPaceOffsetSec);
  const [intervalOff, setIntervalOff] = useState(settings.intervalPaceOffsetSec);
  const [longOff, setLongOff] = useState(settings.longPaceOffsetSec);

  const sortedTrainingDays = useMemo(
    () => [...trainingDays].sort((a, b) => DAY_ORDER.indexOf(a) - DAY_ORDER.indexOf(b)),
    [trainingDays],
  );

  function toggleTrainingDay(day: Day) {
    setTrainingDays((prev) => {
      if (prev.includes(day)) {
        setShowTooManyDaysWarning(false);
        return prev.filter((d) => d !== day);
      }
      if (prev.length >= 6) {
        setShowTooManyDaysWarning(true);
        return prev;
      }
      setShowTooManyDaysWarning(false);
      return [...prev, day].sort((a, b) => DAY_ORDER.indexOf(a) - DAY_ORDER.indexOf(b));
    });
  }

  // Sync remote settings into local form state when /api/settings returns fresh data.
  /* eslint-disable react-hooks/set-state-in-effect -- single batch hydrate from API */
  useEffect(() => {
    if (loading) return;

    setPlanStartDateIsoYmd(settings.planStartDate ? toBrisbaneYmd(new Date(settings.planStartDate)) : "");
    setExperienceLevel(settings.experienceLevel ?? "BEGINNER");
    setGoalRace(settings.goalRace ?? "HALF");
    setPlanLengthWeeks((settings.planLengthWeeks ?? 16) as 12 | 16 | 20);
    setTrainingDays(parseTrainingDaysValue(settings.trainingDays));
    setSelectedLongRunDay(parseLongRunDayValue(settings.longRunDay));
    setMaxHR(settings.maxHR);
    setVdot(settings.currentVdot);
    setVdotRaceDistance(settings.vdotRaceDistance ?? null);
    setVdotRaceMinutes(settings.vdotRaceMinutes ?? null);
    setVdotRaceSeconds(settings.vdotRaceSeconds ?? null);
    setVdotPersonal({
      ageInput: settings.age != null ? String(settings.age) : "",
      gender: settings.gender ?? "",
      weightInput: settings.weightKg != null && Number.isFinite(settings.weightKg) ? String(settings.weightKg) : "",
      runningExperience: settings.runningExperience ?? "",
    });
    setEasyOff(settings.easyPaceOffsetSec);
    setTempoOff(settings.tempoPaceOffsetSec);
    setIntervalOff(settings.intervalPaceOffsetSec);
    setLongOff(settings.longPaceOffsetSec);
  }, [loading, settings]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const effectiveLongRunDay = useMemo<Day | null>(() => {
    if (sortedTrainingDays.length < 2) return null;
    if (selectedLongRunDay && sortedTrainingDays.includes(selectedLongRunDay)) return selectedLongRunDay;
    return getDefaultLongRunDay(sortedTrainingDays);
  }, [selectedLongRunDay, sortedTrainingDays]);

  const scheduleWarnings = useMemo(
    () => (effectiveLongRunDay ? getScheduleWarnings(sortedTrainingDays, effectiveLongRunDay, experienceLevel) : []),
    [effectiveLongRunDay, sortedTrainingDays, experienceLevel],
  );

  const runningExperienceForPaces =
    vdotPersonal.runningExperience || settings.runningExperience;

  const minPlanStartIsoYmd = useMemo(() => toBrisbaneYmd(new Date()), []);

  async function applyVdotCalculatorPatch(payload: {
    vdot: number;
    maxHR: number;
    vdotRaceDistance: string;
    vdotRaceMinutes: number;
    vdotRaceSeconds: number;
    age: number | null;
    gender: string | null;
    weightKg: number | null;
    runningExperience: string | null;
  }) {
    setSaveError(null);
    const draft = buildDraftSettings(settings, {
      currentVdot: payload.vdot,
      maxHR: payload.maxHR,
      vdotRaceDistance: payload.vdotRaceDistance,
      vdotRaceMinutes: payload.vdotRaceMinutes,
      vdotRaceSeconds: payload.vdotRaceSeconds,
      age: payload.age,
      gender: payload.gender,
      weightKg: payload.weightKg,
      runningExperience: payload.runningExperience,
      easyPaceOffsetSec: 0,
      tempoPaceOffsetSec: 0,
      intervalPaceOffsetSec: 0,
      longPaceOffsetSec: 0,
    });
    const zones = deriveRatingPaceZones(draft);
    try {
      await updateSettings({
        currentVdot: payload.vdot,
        maxHR: payload.maxHR,
        vdotRaceDistance: payload.vdotRaceDistance,
        vdotRaceMinutes: payload.vdotRaceMinutes,
        vdotRaceSeconds: payload.vdotRaceSeconds,
        age: payload.age,
        gender: payload.gender,
        weightKg: payload.weightKg,
        runningExperience: payload.runningExperience,
        easyPaceOffsetSec: 0,
        tempoPaceOffsetSec: 0,
        intervalPaceOffsetSec: 0,
        longPaceOffsetSec: 0,
        ...zones,
      });
      setVdot(payload.vdot);
      setMaxHR(payload.maxHR);
      setVdotRaceDistance(payload.vdotRaceDistance);
      setVdotRaceMinutes(payload.vdotRaceMinutes);
      setVdotRaceSeconds(payload.vdotRaceSeconds);
      setEasyOff(0);
      setTempoOff(0);
      setIntervalOff(0);
      setLongOff(0);
      setVdotUpdatedMsg(`VDOT updated to ${payload.vdot}`);
    } catch {
      setSaveError("Failed to save VDOT. Please try again.");
    }
  }

  async function handleMainSave() {
    setSaveError(null);
    setSaveStatus("saving");
    try {
      const trimmedIsoYmd = planStartDateIsoYmd.trim();
      let planIso: string | null = null;
      if (trimmedIsoYmd) {
        const isoYmd = trimmedIsoYmd;
        if (!/^\d{4}-\d{2}-\d{2}$/.test(isoYmd)) {
          throw new Error("Invalid plan start date (expected yyyy-mm-dd)");
        }
        if (isoYmd < minPlanStartIsoYmd) {
          throw new Error("Plan start date cannot be in the past.");
        }
        planIso = brisbaneMidnightUtcForYmd(isoYmd).toISOString();
      }

      if (sortedTrainingDays.length < 2) {
        throw new Error("Select at least 2 training days.");
      }

      const ageParsed = vdotPersonal.ageInput.trim() === "" ? null : Number(vdotPersonal.ageInput);
      const age = ageParsed != null && Number.isFinite(ageParsed) ? Math.round(ageParsed) : null;
      const wParsed = vdotPersonal.weightInput.trim() === "" ? null : Number(vdotPersonal.weightInput);
      const weightKg = wParsed != null && Number.isFinite(wParsed) ? wParsed : null;

      const draft = buildDraftSettings(settings, {
        planStartDate: planIso,
        experienceLevel,
        goalRace,
        planLengthWeeks,
        trainingDays: JSON.stringify(sortedTrainingDays),
        longRunDay: effectiveLongRunDay,
        maxHR,
        currentVdot: vdot,
        age,
        gender: vdotPersonal.gender || null,
        weightKg,
        runningExperience: vdotPersonal.runningExperience || null,
        easyPaceOffsetSec: easyOff,
        tempoPaceOffsetSec: tempoOff,
        intervalPaceOffsetSec: intervalOff,
        longPaceOffsetSec: longOff,
      });
      const zones = deriveRatingPaceZones(draft);

      await updateSettings({
        planStartDate: planIso,
        experienceLevel,
        goalRace,
        planLengthWeeks,
        trainingDays: JSON.stringify(sortedTrainingDays),
        longRunDay: effectiveLongRunDay,
        maxHR,
        currentVdot: vdot,
        vdotRaceDistance,
        vdotRaceMinutes,
        vdotRaceSeconds,
        age,
        gender: vdotPersonal.gender || null,
        weightKg,
        runningExperience: vdotPersonal.runningExperience || null,
        easyPaceOffsetSec: easyOff,
        tempoPaceOffsetSec: tempoOff,
        intervalPaceOffsetSec: intervalOff,
        longPaceOffsetSec: longOff,
        ...zones,
      });

      const regenRes = await fetch("/api/plans/regenerate", {
        method: "POST",
        headers: authJsonHeaders,
      });
      if (!regenRes.ok) throw new Error("Plan regeneration failed");

      const rebuildRes = await fetch("/api/plans/rebuild-paces", {
        method: "POST",
        headers: authJsonHeaders,
        body: JSON.stringify({ vdot }),
      });
      if (!rebuildRes.ok) throw new Error("Rebuild paces failed");

      try {
        const backfillRes = await fetch("/api/runs/backfill-ratings", {
          method: "POST",
        });
        if (!backfillRes.ok) {
          console.error("Backfill failed — ratings may be stale", backfillRes.status);
        }
      } catch (backfillErr) {
        console.error("Backfill failed — ratings may be stale", backfillErr);
      }

      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2000);
      window.location.href = "/program";
    } catch (e) {
      console.error(e);
      setSaveStatus("error");
      setSaveError(e instanceof Error ? e.message : "Save failed");
      setTimeout(() => setSaveStatus("idle"), 3000);
    }
  }

  if (loading) {
    return (
      <div className="rounded-2xl border bg-white/[0.04] border-white/[0.08] backdrop-blur-sm p-5 text-sm">
        Loading settings…
      </div>
    );
  }

  return (
    <div className="space-y-5 w-full max-w-2xl min-w-0">
      <Panel number="1." title="Training plan configuration">
        <Field label="Plan start date" hint="First day your program counts (Brisbane calendar)">
          <div className="flex flex-col gap-2">
            <input
              type="date"
              value={planStartDateIsoYmd}
              min={minPlanStartIsoYmd}
              onChange={(e) => setPlanStartDateIsoYmd(e.target.value)}
              className={`w-full px-4 py-2.5 rounded-xl text-sm bg-white/[0.06] border border-white/[0.10] text-white outline-none focus:border-teal-500/50 transition-colors ${FORM_CONTROL_TW}`}
            />
            {planStartDateIsoYmd ? (
              <p className="text-xs mt-1.5" style={{ color: "var(--text-dim)" }}>
                {planStartIsoYmdToAusDisplay(planStartDateIsoYmd)}
              </p>
            ) : null}
          </div>
        </Field>

        <div className="space-y-4">
          <div>
            <p className="text-sm font-medium text-white mb-2">Experience level</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {([
                ["BEGINNER", "0–12 months running. Conservative progression."],
                ["INTERMEDIATE", "1–3 years running. Balanced mix of sessions."],
                ["ADVANCED", "3+ years running. High intensity from week 1."],
              ] as const).map(([lvl, copy]) => (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => setExperienceLevel(lvl)}
                  className="p-4 rounded-xl border cursor-pointer transition-all text-left hover:bg-white/[0.07]"
                  style={{
                    background: experienceLevel === lvl ? "rgba(45,212,191,0.08)" : "rgba(255,255,255,0.04)",
                    border: experienceLevel === lvl ? "1px solid rgba(45,212,191,0.35)" : "1px solid rgba(255,255,255,0.08)",
                  }}
                >
                  <p className="text-sm font-bold text-white mb-1">{lvl}</p>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>{copy}</p>
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-sm font-medium text-white mb-2">Goal race</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setGoalRace("HALF")}
                className="p-4 rounded-xl border cursor-pointer transition-all text-left hover:bg-white/[0.07]"
                style={{
                  background: goalRace === "HALF" ? "rgba(45,212,191,0.08)" : "rgba(255,255,255,0.04)",
                  border: goalRace === "HALF" ? "1px solid rgba(45,212,191,0.35)" : "1px solid rgba(255,255,255,0.08)",
                }}
              >
                <p className="text-sm font-bold text-white mb-1">HALF MARATHON</p>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>21.1 km</p>
              </button>
              <button
                type="button"
                onClick={() => setGoalRace("FULL")}
                className="p-4 rounded-xl border cursor-pointer transition-all text-left hover:bg-white/[0.07]"
                style={{
                  background: goalRace === "FULL" ? "rgba(45,212,191,0.08)" : "rgba(255,255,255,0.04)",
                  border: goalRace === "FULL" ? "1px solid rgba(45,212,191,0.35)" : "1px solid rgba(255,255,255,0.08)",
                }}
              >
                <p className="text-sm font-bold text-white mb-1">FULL MARATHON</p>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>42.2 km</p>
              </button>
            </div>
          </div>

          <div>
            <p className="text-sm font-medium text-white mb-2">Plan length</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {([12, 16, 20] as const).map((weeks) => (
                <button
                  key={weeks}
                  type="button"
                  onClick={() => setPlanLengthWeeks(weeks)}
                  className="p-4 rounded-xl border cursor-pointer transition-all text-left hover:bg-white/[0.07]"
                  style={{
                    background: planLengthWeeks === weeks ? "rgba(45,212,191,0.08)" : "rgba(255,255,255,0.04)",
                    border: planLengthWeeks === weeks ? "1px solid rgba(45,212,191,0.35)" : "1px solid rgba(255,255,255,0.08)",
                  }}
                >
                  <p className="text-sm font-bold text-white mb-1">{weeks} WEEKS</p>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                    {weeks === 12 ? "For runners with a race soon or a strong base." : weeks === 16 ? "Standard plan length. Recommended for most runners." : "Extra base building time. Ideal for beginners."}
                  </p>
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-sm font-medium text-white mb-2">Training days</p>
            <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
              {DAYS.map((day) => {
                const selected = trainingDays.includes(day);
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => toggleTrainingDay(day)}
                    className="px-4 py-2.5 rounded-xl text-sm font-semibold cursor-pointer transition-all"
                    style={{
                      background: selected ? "rgba(45,212,191,0.12)" : "rgba(255,255,255,0.05)",
                      border: selected ? "1px solid rgba(45,212,191,0.35)" : "1px solid rgba(255,255,255,0.08)",
                      color: selected ? "var(--accent)" : "rgba(255,255,255,0.45)",
                    }}
                  >
                    {DAY_LABEL[day]}
                  </button>
                );
              })}
            </div>
            {trainingDays.length < 2 && <p className="text-xs mt-1 text-orange-300">Select at least 2 training days.</p>}
            {showTooManyDaysWarning && (
              <p className="text-xs mt-1 text-orange-300">
                Running every day increases injury risk. Maximum 6 days recommended.
              </p>
            )}
          </div>

          {trainingDays.length >= 2 && (
            <div>
              <p className="text-sm text-white mb-1">Long run day</p>
              <p className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>
                Which day do you want to do your long run?
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {sortedTrainingDays.map((day) => (
                  <button
                    key={day}
                    type="button"
                    onClick={() => setSelectedLongRunDay(day)}
                    className="px-4 py-2.5 rounded-xl text-sm font-semibold cursor-pointer transition-all"
                    style={{
                      background: effectiveLongRunDay === day ? "rgba(45,212,191,0.12)" : "rgba(255,255,255,0.05)",
                      border: effectiveLongRunDay === day ? "1px solid rgba(45,212,191,0.35)" : "1px solid rgba(255,255,255,0.08)",
                      color: effectiveLongRunDay === day ? "var(--accent)" : "rgba(255,255,255,0.45)",
                    }}
                  >
                    {DAY_LABEL[day]}
                  </button>
                ))}
              </div>
              {scheduleWarnings.length > 0 && (
                <div className="mt-3 space-y-1">
                  {scheduleWarnings.map((warning) => (
                    <p key={warning} className="flex items-center gap-2 text-xs mt-2" style={{ color: "#f5b454" }}>
                      {warning}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </Panel>

      <Panel number="2." title="Your fitness">
        <p className="text-xs mb-2" style={{ color: "var(--text-muted)" }}>
          Current VDOT: <span className="font-semibold text-white">{vdot}</span>
        </p>
        {settings.lastEstimatedVdot != null && settings.lastEstimatedVdot === settings.currentVdot && (
          <p className="text-xs mb-2" style={{ color: "#5eead4" }}>
            Your VDOT was automatically updated to {settings.currentVdot} based on your recent runs.
          </p>
        )}
        <VdotCalculator
          maxHR={maxHR}
          onMaxHRChange={setMaxHR}
          personal={vdotPersonal}
          onPersonalChange={setVdotPersonal}
          seedRaceDistance={vdotRaceDistance}
          seedRaceMinutes={vdotRaceMinutes}
          seedRaceSeconds={vdotRaceSeconds ?? 0}
          onApply={(nextVdot) => {
            setVdot(nextVdot);
            setVdotUpdatedMsg(`VDOT updated to ${nextVdot}`);
          }}
          onFitnessSave={applyVdotCalculatorPatch}
          onLevelSuggested={(lvl) => setSuggestedLevel(lvl)}
        />
        {vdotUpdatedMsg && (
          <p className="text-xs mt-2" style={{ color: "#5eead4" }}>{vdotUpdatedMsg}</p>
        )}
        {suggestedLevel && suggestedLevel !== experienceLevel && (
          <div
            className="mt-2 rounded-md p-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
            style={{ background: "rgba(45,212,191,0.08)", border: "1px solid rgba(45,212,191,0.22)" }}
          >
            <p className="text-xs" style={{ color: "#99f6e4" }}>
              Based on your VDOT, we suggest: {suggestedLevel === "BEGINNER" ? "Beginner" : suggestedLevel === "INTERMEDIATE" ? "Intermediate" : "Advanced"}
            </p>
            <button
              type="button"
              onClick={() => setExperienceLevel(suggestedLevel)}
              className="min-h-11 rounded-md px-3 py-2 text-xs font-medium"
              style={{ background: "rgba(45,212,191,0.18)", color: "#5eead4", border: "1px solid rgba(45,212,191,0.32)" }}
            >
              Apply suggestion
            </button>
          </div>
        )}
        {saveError && <p className="text-xs text-red-300 mt-2">{saveError}</p>}
      </Panel>

      <Panel number="3." title="Your pace zones">
        <p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>
          Adjust how your planned paces relate to your VDOT. Offsets stay fixed when VDOT changes so your feel preference carries over.
        </p>
        <div>
          <div className="py-4 border-b border-white/[0.06] last:border-0">
            <PaceZoneOffsetSlider zone="easy" label="Easy" vdot={vdot} runningExperience={runningExperienceForPaces} offsetSec={easyOff} onOffsetChange={setEasyOff} />
          </div>
          <div className="py-4 border-b border-white/[0.06] last:border-0">
            <PaceZoneOffsetSlider zone="tempo" label="Tempo" vdot={vdot} runningExperience={runningExperienceForPaces} offsetSec={tempoOff} onOffsetChange={setTempoOff} />
          </div>
          <div className="py-4 border-b border-white/[0.06] last:border-0">
            <PaceZoneOffsetSlider zone="interval" label="Interval" vdot={vdot} runningExperience={runningExperienceForPaces} offsetSec={intervalOff} onOffsetChange={setIntervalOff} />
          </div>
          <div className="py-4 border-b border-white/[0.06] last:border-0">
            <PaceZoneOffsetSlider zone="long" label="Long run" vdot={vdot} runningExperience={runningExperienceForPaces} offsetSec={longOff} onOffsetChange={setLongOff} />
          </div>
        </div>
      </Panel>

      <Panel number="4." title="Save">
        <p className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>
          Saves your plan, fitness, and pace zones. Regenerates your program and refreshes run ratings.
        </p>
        <SaveButton status={saveStatus} onClick={() => { void handleMainSave(); }} />
        {saveError && <p className="text-xs text-red-300 mt-2">{saveError}</p>}
      </Panel>
    </div>
  );
}
