"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
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
type Tab = "goal" | "schedule" | "fitness";

function SaveButton({ status, onClick }: { status: SaveStatus; onClick: () => void }) {
  const label =
    status === "saving" ? "Saving..."
    : status === "saved" ? "Saved"
    : status === "error" ? "Error"
    : "Save Changes";
  const isSaving = status === "saving";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isSaving}
      className="px-8 py-3 rounded-xl text-sm font-bold transition-all w-full sm:w-auto hover:bg-[#14b8a6] shadow-lg shadow-teal-500/10"
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

function Panel({ title, children, badge }: { title: string; children: React.ReactNode; badge?: string }) {
  return (
    <div
      className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5 mb-5 space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-500"
    >
      <div className="flex items-center justify-between pb-3 mb-1 border-b border-white/[0.08]">
        <h2 className="text-base font-bold text-white uppercase tracking-tight">{title}</h2>
        {badge && (
          <span className="text-[10px] font-black px-2 py-0.5 rounded bg-white/10 text-white/40 tracking-widest uppercase">
            {badge}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-6 py-1">
      <div className="w-full sm:w-48 shrink-0">
        <p className="text-sm font-semibold text-white/90 mb-1">{label}</p>
        {hint && <p className="text-xs leading-relaxed" style={{ color: "var(--text-dim)" }}>{hint}</p>}
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

  const [activeTab, setActiveTab] = useState<Tab>("goal");
  const [planStartDateIsoYmd, setPlanStartDateIsoYmd] = useState(() =>
    settings.planStartDate ? toBrisbaneYmd(new Date(settings.planStartDate)) : ""
  );
  const [experienceLevel, setExperienceLevel] = useState<"NOVICE" | "BEGINNER" | "INTERMEDIATE" | "ADVANCED" | "ELITE">(
    (settings.experienceLevel as any) ?? "BEGINNER",
  );
  const [goalRace, setGoalRace] = useState<"5K" | "10K" | "HALF" | "FULL">((settings.goalRace as any) ?? "HALF");
  const [planLengthWeeks, setPlanLengthWeeks] = useState<8 | 12 | 16 | 20>((settings.planLengthWeeks ?? 16) as 8 | 12 | 16 | 20);

  // Safeguard: Novices are restricted to 5K/10K
  useEffect(() => {
    if (experienceLevel === "NOVICE" && (goalRace === "HALF" || goalRace === "FULL")) {
      setGoalRace("5K");
    }
  }, [experienceLevel, goalRace]);

  const [trainingDays, setTrainingDays] = useState<Day[]>(() => parseTrainingDaysValue(settings.trainingDays));
  const [selectedLongRunDay, setSelectedLongRunDay] = useState<Day | null>(() => parseLongRunDayValue(settings.longRunDay));

  const syncedRef = useRef(false);

  const [vdotUpdatedMsg, setVdotUpdatedMsg] = useState<string | null>(null);
  const [reclassifiedMsg, setReclassifiedMsg] = useState<string | null>(null);
  const [suggestedLevel, setSuggestedLevel] = useState<"BEGINNER" | "INTERMEDIATE" | "ADVANCED" | null>(null);
  const [showTooManyDaysWarning, setShowTooManyDaysWarning] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [firstName, setFirstName] = useState(settings.firstName ?? "");
  const [nickname, setNickname] = useState(settings.nickname ?? "");

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

  // Progressive Disclosure: Auto-switch tab if NOVICE views fitness
  useEffect(() => {
    if (experienceLevel === "NOVICE" && activeTab === "fitness") {
      setActiveTab("goal");
    }
  }, [experienceLevel, activeTab]);

  // One-time hydration from DB — guard prevents re-running on every updateSettings call.
  useEffect(() => {
    if (loading) return;
    if (syncedRef.current) return;
    syncedRef.current = true;

    const loaded = settings.planStartDate ? toBrisbaneYmd(new Date(settings.planStartDate)) : "";
    setPlanStartDateIsoYmd(loaded);
    setExperienceLevel(settings.experienceLevel ?? "BEGINNER");
    setGoalRace(settings.goalRace ?? "HALF");
    setPlanLengthWeeks((settings.planLengthWeeks ?? 16) as 8 | 12 | 16 | 20);
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
    setFirstName(settings.firstName ?? "");
    setNickname(settings.nickname ?? "");
  }, [loading, settings]);

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
      const res = await updateSettings({
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
      if (res.reclassified > 0) {
        setReclassifiedMsg(`${res.reclassified} runs reclassified automatically.`);
        setTimeout(() => setReclassifiedMsg(null), 3000);
      }
    } catch {
      setSaveError("Failed to save VDOT. Please try again.");
    }
  }

  async function handleMainSave() {
    setSaveError(null);
    setReclassifiedMsg(null);
    setSaveStatus("saving");
    try {
      const trimmedIsoYmd = planStartDateIsoYmd.trim();
      let planIso: string | null = null;
      if (trimmedIsoYmd) {
        const isoYmd = trimmedIsoYmd;
        if (!/^\d{4}-\d{2}-\d{2}$/.test(isoYmd)) {
          throw new Error("Invalid plan start date (expected yyyy-mm-dd)");
        }
        const loadedPlanStart = settings.planStartDate ? toBrisbaneYmd(new Date(settings.planStartDate)) : "";
        const isNewDate = isoYmd !== loadedPlanStart;
        if (isNewDate && isoYmd < minPlanStartIsoYmd) {
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
        firstName: firstName.trim() || null,
        nickname: nickname.trim() || null,
        easyPaceOffsetSec: easyOff,
        tempoPaceOffsetSec: tempoOff,
        intervalPaceOffsetSec: intervalOff,
        longPaceOffsetSec: longOff,
      });
      const zones = deriveRatingPaceZones(draft);

      const updateRes = await updateSettings({
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
        firstName: firstName.trim() || null,
        nickname: nickname.trim() || null,
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

      if (updateRes.reclassified > 0) {
        setReclassifiedMsg(`${updateRes.reclassified} runs reclassified automatically.`);
      }

      setSaveStatus("saved");
      setTimeout(() => {
        setSaveStatus("idle");
        window.location.href = "/program";
      }, 2000);
    } catch (e) {
      console.error(e);
      setSaveStatus("error");
      setSaveError(e instanceof Error ? e.message : "Save failed");
      setTimeout(() => setSaveStatus("idle"), 3000);
    }
  }

  if (loading) {
    return (
      <div className="rounded-2xl border bg-[var(--card-bg)] border-white/[0.08] backdrop-blur-sm p-5 text-sm">
        Loading settings…
      </div>
    );
  }

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: "goal", label: "Goal & Level" },
    { id: "schedule", label: "Schedule" },
  ];
  if (experienceLevel !== "NOVICE") {
    tabs.push({ id: "fitness", label: "Fitness & Pacing" });
  }

  return (
    <div className="w-full max-w-2xl min-w-0">
      {/* ── Tab Navigation ───────────────────────────────────────────── */}
      <div className="flex border-b border-white/[0.08] mb-6 overflow-x-auto no-scrollbar">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className="px-6 py-4 text-sm font-bold transition-all border-b-2 whitespace-nowrap"
            style={{
              borderColor: activeTab === tab.id ? "var(--accent)" : "transparent",
              color: activeTab === tab.id ? "var(--accent)" : "rgba(255,255,255,0.45)",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <Panel title="Guided setup" badge="Wizard">
        <p className="text-sm mb-4" style={{ color: "var(--text-muted)" }}>
          Open the same step-by-step onboarding flow. Your saved profile from the server loads automatically so you can tweak anything and regenerate your plan.
        </p>
        <Link
          href="/onboarding?from=settings"
          className="inline-flex items-center justify-center px-6 py-3 rounded-xl text-sm font-bold border border-white/15 text-white hover:bg-white/10 transition-colors"
        >
          Continue in setup wizard
        </Link>
      </Panel>

      <div className="space-y-4">
        {/* ── Tab 1: Goal & Level ────────────────────────────────────── */}
        {activeTab === "goal" && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
            {experienceLevel === "NOVICE" && (
              <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/20 mb-6 flex items-start gap-3">
                <span className="text-xl">ℹ️</span>
                <p className="text-sm text-blue-200/90 leading-relaxed">
                  Novice plans focus purely on time-on-feet and effort (RPE). Advanced pace metrics are disabled to keep your foundation-building simple and stress-free.
                </p>
              </div>
            )}

            <Panel title="Profile" badge="Profile">
              <Field label="First name">
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className={`w-full px-4 py-2.5 rounded-xl text-sm outline-none transition-colors ${FORM_CONTROL_TW}`}
                  placeholder="First name"
                />
              </Field>
              <Field label="Nickname" hint="We'll use this throughout the app.">
                <input
                  type="text"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  className={`w-full px-4 py-2.5 rounded-xl text-sm outline-none transition-colors ${FORM_CONTROL_TW}`}
                  placeholder="Nickname (optional)"
                />
              </Field>
            </Panel>

            <Panel title="Configuration" badge="Goal">
              <Field label="Plan start date" hint="First day your program counts.">
                <div className="flex flex-col gap-2">
                  <input
                    type="date"
                    value={planStartDateIsoYmd}
                    min={minPlanStartIsoYmd}
                    onChange={(e) => setPlanStartDateIsoYmd(e.target.value)}
                    className={`w-full px-4 py-2.5 rounded-xl text-sm bg-white/[0.06] border border-white/[0.10] text-white outline-none focus:border-teal-400 transition-colors ${FORM_CONTROL_TW}`}
                  />
                  {planStartDateIsoYmd && (
                    <p className="text-xs mt-1.5" style={{ color: "var(--text-dim)" }}>
                      {planStartIsoYmdToAusDisplay(planStartDateIsoYmd)}
                    </p>
                  )}
                </div>
              </Field>

              <div className="pt-4 space-y-6">
                <div>
                  <p className="text-sm font-semibold text-white/90 mb-3">Experience level</p>
                  <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
                    {([
                      ["NOVICE", "Just starting out. Focus on consistency."],
                      ["BEGINNER", "0–12 months. Conservative progression."],
                      ["INTERMEDIATE", "1–3 years. Balanced mix."],
                      ["ADVANCED", "3+ years. High intensity focus."],
                      ["ELITE", "Competitive. High volume/intensity."],
                    ] as const).map(([lvl, copy]) => (
                      <button
                        key={lvl}
                        type="button"
                        onClick={() => setExperienceLevel(lvl)}
                        className="p-3.5 rounded-xl border cursor-pointer transition-all text-left hover:bg-white/[0.07]"
                        style={{
                          background: experienceLevel === lvl ? "rgba(45,212,191,0.08)" : "var(--card-bg)",
                          border: experienceLevel === lvl ? "2px solid rgba(45,212,191,0.60)" : "1px solid rgba(255,255,255,0.08)",
                        }}
                      >
                        <p className="text-xs font-black text-white mb-1">{lvl}</p>
                        <p className="text-[10px] leading-tight" style={{ color: "var(--text-muted)" }}>{copy}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-sm font-semibold text-white/90 mb-3">Goal race</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {([
                      ["5K", "5.0 km"],
                      ["10K", "10.0 km"],
                      ["HALF", "21.1 km"],
                      ["FULL", "42.2 km"],
                    ] as const)
                      .filter(([goal]) => !(experienceLevel === "NOVICE" && (goal === "HALF" || goal === "FULL")))
                      .map(([goal, dist]) => (
                        <button
                          key={goal}
                          type="button"
                          onClick={() => setGoalRace(goal)}
                          className="p-3.5 rounded-xl border cursor-pointer transition-all text-left hover:bg-white/[0.07]"
                          style={{
                            background: goalRace === goal ? "rgba(45,212,191,0.08)" : "var(--card-bg)",
                            border: goalRace === goal ? "2px solid rgba(45,212,191,0.60)" : "1px solid rgba(255,255,255,0.08)",
                          }}
                        >
                          <p className="text-xs font-black text-white mb-1">
                            {goal === "HALF" ? "HALF MAR" : goal === "FULL" ? "MARATHON" : goal}
                          </p>
                          <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>{dist}</p>
                        </button>
                      ))}
                  </div>
                  {experienceLevel === "NOVICE" && (
                    <p className="text-[10px] mt-3 text-teal-400/80 font-medium">
                      Novice plans are restricted to 5k and 10k to ensure safe, injury-free progression.
                    </p>
                  )}
                </div>

                <div>
                  <p className="text-sm font-semibold text-white/90 mb-3">Plan length</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {([8, 12, 16, 20] as const).map((weeks) => (
                      <button
                        key={weeks}
                        type="button"
                        onClick={() => setPlanLengthWeeks(weeks)}
                        className="p-3.5 rounded-xl border cursor-pointer transition-all text-left hover:bg-white/[0.07]"
                        style={{
                          background: planLengthWeeks === weeks ? "rgba(45,212,191,0.08)" : "var(--card-bg)",
                          border: planLengthWeeks === weeks ? "2px solid rgba(45,212,191,0.60)" : "1px solid rgba(255,255,255,0.08)",
                        }}
                      >
                        <p className="text-xs font-black text-white mb-1">{weeks} WEEKS</p>
                        <p className="text-[10px] leading-tight" style={{ color: "var(--text-muted)" }}>
                          {weeks === 8 ? "Crash course." : weeks === 12 ? "Strong base." : weeks === 16 ? "Standard." : "Extra base."}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </Panel>
          </div>
        )}

        {/* ── Tab 2: Schedule ────────────────────────────────────────── */}
        {activeTab === "schedule" && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
            <Panel title="Training Schedule" badge="Weekly">
              <div>
                <p className="text-sm font-semibold text-white/90 mb-4">Select training days</p>
                <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
                  {DAYS.map((day) => {
                    const selected = trainingDays.includes(day);
                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => toggleTrainingDay(day)}
                        className="px-2 py-3 rounded-xl text-[11px] font-black cursor-pointer transition-all"
                        style={{
                          background: selected ? "rgba(45,212,191,0.12)" : "rgba(255,255,255,0.05)",
                          border: selected ? "2px solid rgba(45,212,191,0.60)" : "1px solid rgba(255,255,255,0.08)",
                          color: selected ? "var(--accent)" : "rgba(255,255,255,0.45)",
                        }}
                      >
                        {DAY_LABEL[day].toUpperCase()}
                      </button>
                    );
                  })}
                </div>
                {trainingDays.length < 2 && <p className="text-xs mt-2 text-orange-300">Select at least 2 training days.</p>}
                {showTooManyDaysWarning && (
                  <p className="text-xs mt-2 text-orange-300">
                    Running every day increases injury risk. Maximum 6 days recommended.
                  </p>
                )}
              </div>

              {trainingDays.length >= 2 && (
                <div className="pt-4 border-t border-white/[0.06]">
                  <p className="text-sm font-semibold text-white/90 mb-1">Long run day</p>
                  <p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>
                    Which day do you want to do your sustained weekly effort?
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {sortedTrainingDays.map((day) => (
                      <button
                        key={day}
                        type="button"
                        onClick={() => setSelectedLongRunDay(day)}
                        className="px-4 py-2.5 rounded-xl text-xs font-black cursor-pointer transition-all"
                        style={{
                          background: effectiveLongRunDay === day ? "rgba(45,212,191,0.12)" : "rgba(255,255,255,0.05)",
                          border: effectiveLongRunDay === day ? "2px solid rgba(45,212,191,0.60)" : "1px solid rgba(255,255,255,0.08)",
                          color: effectiveLongRunDay === day ? "var(--accent)" : "rgba(255,255,255,0.45)",
                        }}
                      >
                        {DAY_LABEL[day].toUpperCase()}
                      </button>
                    ))}
                  </div>
                  {scheduleWarnings.length > 0 && (
                    <div className="mt-4 space-y-1">
                      {scheduleWarnings.map((warning) => (
                        <p key={warning} className="flex items-center gap-2 text-xs text-orange-300/80">
                          <span>⚠️</span> {warning}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </Panel>
          </div>
        )}

        {/* ── Tab 3: Fitness & Pacing ─────────────────────────────────── */}
        {activeTab === "fitness" && experienceLevel !== "NOVICE" && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
            <Panel title="Advanced Fitness" badge="VDOT">
              <div className="mb-4">
                <p className="text-xs font-medium text-white/40 uppercase tracking-widest mb-1">Current Metric</p>
                <p className="text-2xl font-black font-mono text-white tracking-tighter">VDOT {vdot}</p>
                {settings.lastEstimatedVdot != null && settings.lastEstimatedVdot === settings.currentVdot && (
                  <p className="text-xs mt-1.5 text-teal-400 font-medium">
                    ✨ Automatically updated from recent activities.
                  </p>
                )}
              </div>
              
              <VdotCalculator
                maxHR={maxHR}
                onMaxHRChange={setMaxHR}
                personal={vdotPersonal}
                isNovice={false}
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
                <p className="text-xs mt-3 text-teal-300 font-medium">{vdotUpdatedMsg}</p>
              )}
              {suggestedLevel && suggestedLevel !== experienceLevel && (
                <div
                  className="mt-4 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
                  style={{ background: "rgba(45,212,191,0.05)", border: "1px solid rgba(45,212,191,0.15)" }}
                >
                  <p className="text-xs text-teal-100/80 leading-relaxed">
                    Based on your recent performance, we suggest moving to the <strong className="text-white">{suggestedLevel}</strong> tier.
                  </p>
                  <button
                    type="button"
                    onClick={() => setExperienceLevel(suggestedLevel)}
                    className="whitespace-nowrap rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-widest"
                    style={{ background: "rgba(45,212,191,0.15)", color: "var(--accent)", border: "1px solid rgba(45,212,191,0.30)" }}
                  >
                    Apply Level
                  </button>
                </div>
              )}
            </Panel>

            <Panel title="Pace Calibration" badge="Zones">
              <p className="text-xs leading-relaxed text-white/40 mb-6">
                Fine-tune your targets. Moving the sliders adjusts your planned paces relative to your VDOT baseline. These offsets persist even when your VDOT changes.
              </p>
              <div className="space-y-2">
                <div className="py-2">
                  <PaceZoneOffsetSlider zone="easy" label="Easy" vdot={vdot} runningExperience={runningExperienceForPaces} offsetSec={easyOff} onOffsetChange={setEasyOff} />
                </div>
                <div className="py-2">
                  <PaceZoneOffsetSlider zone="tempo" label="Tempo" vdot={vdot} runningExperience={runningExperienceForPaces} offsetSec={tempoOff} onOffsetChange={setTempoOff} />
                </div>
                <div className="py-2">
                  <PaceZoneOffsetSlider zone="interval" label="Interval" vdot={vdot} runningExperience={runningExperienceForPaces} offsetSec={intervalOff} onOffsetChange={setIntervalOff} />
                </div>
                <div className="py-2">
                  <PaceZoneOffsetSlider zone="long" label="Long Run" vdot={vdot} runningExperience={runningExperienceForPaces} offsetSec={longOff} onOffsetChange={setLongOff} />
                </div>
              </div>
            </Panel>
          </div>
        )}

        {/* ── Save Bar ────────────────────────────────────────────────── */}
        <div className="sticky bottom-4 z-10 mt-8 p-4 rounded-2xl border border-white/[0.12] bg-zinc-900/90 backdrop-blur-xl shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="text-center sm:text-left">
            <p className="text-xs font-black text-white/90 uppercase tracking-widest mb-1">Finalise Changes</p>
            <p className="text-[10px] text-white/40">Program will regenerate upon saving.</p>
          </div>
          <div className="w-full sm:w-auto flex flex-col items-end">
            <SaveButton status={saveStatus} onClick={() => { void handleMainSave(); }} />
            {reclassifiedMsg && <p className="text-[10px] text-teal-400 mt-2 font-bold uppercase tracking-tighter">{reclassifiedMsg}</p>}
            {saveError && <p className="text-[10px] text-red-400 mt-2 font-bold uppercase tracking-tighter">{saveError}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
