"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronLeft, ChevronRight, Info } from "lucide-react";
import type { Day, PlanConfig } from "@/data/trainingPlan";
import { useSettings } from "@/context/SettingsContext";
import { getDefaultLongRunDay, getScheduleWarnings } from "@/lib/generatePlan";
import { toBrisbaneYmd } from "@/lib/dateUtils";
import VdotCalculator, { type VdotPersonalFields } from "@/components/VdotCalculator";
import { FORM_CONTROL_TW } from "@/lib/formControlClasses";

// ── Types ──────────────────────────────────────────────────────────────────

type Level = "NOVICE" | "BEGINNER" | "INTERMEDIATE" | "ADVANCED" | "ELITE";
type GoalRace = "5K" | "10K" | "HALF" | "FULL";

interface OnboardingState {
  firstName: string;
  nickname: string;
  experienceLevel: Level | null;
  goalRace: GoalRace | null;
  planLengthWeeks: 8 | 12 | 16 | 20;
  trainingDays: Day[];
  longRunDay: Day | null;
  maxHR: number;
  vdot: number | null;
  targetFinishTimeMins: number | null;
}

// ── Constants ────────────────────────────────────────────────────────────────

const DAYS: Day[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const DAY_LABEL: Record<Day, string> = {
  mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu", fri: "Fri", sat: "Sat", sun: "Sun",
};

const LEVEL_DETAILS: Record<Level, { title: string; desc: string }> = {
  NOVICE: { title: "Novice", desc: "Just starting out. Focus on consistency and walk-runs." },
  BEGINNER: { title: "Beginner", desc: "0–12 months running. Conservative progression." },
  INTERMEDIATE: { title: "Intermediate", desc: "1–3 years running. Balanced mix of sessions." },
  ADVANCED: { title: "Advanced", desc: "3+ years running. High intensity from week 1." },
  ELITE: { title: "Elite", desc: "Competitive athlete. High volume and specificity." },
};

// ── Components ───────────────────────────────────────────────────────────────

function StepIndicator({ currentStep, isNovice }: { currentStep: number; isNovice: boolean }) {
  const steps = isNovice 
    ? [{ id: 1, label: "Goals" }, { id: 2, label: "Schedule" }, { id: 4, label: "Review" }]
    : [{ id: 1, label: "Goals" }, { id: 2, label: "Schedule" }, { id: 3, label: "Fitness" }, { id: 4, label: "Review" }];
  
  const activeIdx = steps.findIndex(s => s.id === currentStep);
  const progress = ((activeIdx + 1) / steps.length) * 100;

  return (
    <div className="mb-12">
      <div className="flex justify-between items-center mb-6">
        {steps.map((s, idx) => {
          const isActive = s.id === currentStep;
          const isCompleted = isNovice 
            ? (currentStep === 4 && s.id < 4) || (currentStep === 2 && s.id === 1)
            : s.id < currentStep;

          return (
            <div key={s.label} className="flex flex-col items-center flex-1 relative">
              <div 
                className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-black transition-all duration-500 z-10 ${
                  isActive ? "bg-teal-500 text-black scale-110 shadow-xl shadow-teal-500/30" : 
                  isCompleted ? "bg-teal-500/20 text-teal-400 border border-teal-500/20" : "bg-white/5 text-white/20 border border-white/5"
                }`}
              >
                {isCompleted ? <Check className="w-5 h-5" strokeWidth={3} /> : idx + 1}
              </div>
              <span className={`text-[10px] mt-3 font-black uppercase tracking-[0.2em] transition-colors duration-500 ${isActive ? "text-white" : "text-white/20"}`}>
                {s.label}
              </span>
              
              {/* Connector Line */}
              {idx < steps.length - 1 && (
                <div className="absolute top-5 left-[50%] w-full h-[2px] bg-white/5 -z-0">
                  <div 
                    className="h-full bg-teal-500/30 transition-all duration-700 ease-in-out" 
                    style={{ width: isCompleted ? "100%" : "0%" }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden shadow-inner">
        <div 
          className="h-full bg-gradient-to-r from-teal-600 to-teal-400 transition-all duration-1000 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

function CardOption({ selected, title, subtitle, onClick, badge }: { 
  selected: boolean; title: string; subtitle: string; onClick: () => void; badge?: string 
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left rounded-2xl p-5 border-2 transition-all duration-300 hover:scale-[1.02] ${
        selected ? "border-teal-500/50 bg-teal-500/5 shadow-lg shadow-teal-500/10" : "border-white/5 bg-white/30 backdrop-blur-sm"
      }`}
    >
      <div className="flex items-center justify-between gap-3 mb-1">
        <p className={`text-sm font-bold ${selected ? "text-white" : "text-white/70"}`}>{title}</p>
        {badge && (
          <span className="text-[10px] px-2 py-0.5 rounded bg-teal-500/20 text-teal-400 font-black uppercase tracking-tighter">
            {badge}
          </span>
        )}
      </div>
      <p className="text-xs leading-relaxed text-white/40">{subtitle}</p>
    </button>
  );
}

// ── Page Component ──────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const router = useRouter();
  const { settings, updateSettings } = useSettings();

  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  
  // State consolidation
  const [form, setForm] = useState<OnboardingState>({
    firstName: settings.firstName ?? "",
    nickname: settings.nickname ?? "",
    experienceLevel: (settings.experienceLevel as Level | null) ?? null,
    goalRace: (settings.goalRace as GoalRace | null) ?? null,
    planLengthWeeks: (settings.planLengthWeeks as any) ?? 16,
    trainingDays: (() => {
      try {
        const parsed = settings.trainingDays ? JSON.parse(settings.trainingDays) : ["wed", "sat", "sun"];
        return Array.isArray(parsed) ? parsed : ["wed", "sat", "sun"];
      } catch { return ["wed", "sat", "sun"]; }
    })(),
    longRunDay: (settings.longRunDay as Day | null) ?? "sun",
    maxHR: settings.maxHR ?? 190,
    vdot: settings.currentVdot ?? null,
    targetFinishTimeMins: settings.targetFinishTime ?? null,
  });

  const [targetTime, setTargetTime] = useState({ hours: "1", mins: "55" });
  const [skipFitness, setSkipFitness] = useState(false);

  // Safeguard: Novices are restricted to 5K/10K
  useEffect(() => {
    if (form.experienceLevel === "NOVICE" && (form.goalRace === "HALF" || form.goalRace === "FULL")) {
      setForm(prev => ({ ...prev, goalRace: "5K" }));
    }
  }, [form.experienceLevel, form.goalRace]);

  const isNovice = form.experienceLevel === "NOVICE";
  const totalSteps = isNovice ? 3 : 4;

  const sortedTrainingDays = useMemo(
    () => [...form.trainingDays].sort((a, b) => DAYS.indexOf(a) - DAYS.indexOf(b)),
    [form.trainingDays]
  );

  const effectiveLongRunDay = useMemo<Day | null>(() => {
    if (sortedTrainingDays.length < 2) return null;
    if (form.longRunDay && sortedTrainingDays.includes(form.longRunDay)) return form.longRunDay;
    return getDefaultLongRunDay(sortedTrainingDays);
  }, [form.longRunDay, sortedTrainingDays]);

  const scheduleWarnings = useMemo(
    () => (effectiveLongRunDay ? getScheduleWarnings(sortedTrainingDays, effectiveLongRunDay, form.experienceLevel ?? undefined) : []),
    [effectiveLongRunDay, sortedTrainingDays, form.experienceLevel]
  );

  const canNext = (() => {
    if (step === 1) return form.firstName.trim().length > 0 && form.experienceLevel != null && form.goalRace != null;
    if (step === 2) return form.trainingDays.length >= 2 && effectiveLongRunDay != null;
    if (step === 3 && !isNovice) return skipFitness || (form.vdot != null);
    return true;
  })();

  const handleNext = () => {
    if (step === 2 && isNovice) {
      setStep(4); // Skip to review
    } else {
      setStep(s => Math.min(4, s + 1));
    }
  };

  const handleBack = () => {
    if (step === 4 && isNovice) {
      setStep(2);
    } else {
      setStep(s => Math.max(1, s - 1));
    }
  };

  async function complete() {
    if (!form.experienceLevel || !form.goalRace || form.trainingDays.length < 2) return;
    setSaving(true);

    const finishMins = isNovice ? null : (parseInt(targetTime.hours, 10) * 60 + parseInt(targetTime.mins, 10));
    
    try {
      await updateSettings({
        firstName: form.firstName.trim(),
        nickname: form.nickname.trim() || null,
        goalRace: form.goalRace,
        experienceLevel: form.experienceLevel,
        planLengthWeeks: form.planLengthWeeks,
        trainingDays: JSON.stringify(sortedTrainingDays),
        longRunDay: effectiveLongRunDay,
        targetFinishTime: finishMins,
        currentVdot: isNovice ? 28 : (form.vdot ?? 33),
        maxHR: form.maxHR,
      });

      const token = process.env.NEXT_PUBLIC_PLANS_API_TOKEN;
      await fetch("/api/plans/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          level: form.experienceLevel,
          goal: form.goalRace === "FULL" ? "full" : form.goalRace === "HALF" ? "hm" : form.goalRace === "10K" ? "10k" : "5k",
          weeks: form.planLengthWeeks,
          days: sortedTrainingDays,
          longRunDay: effectiveLongRunDay ?? undefined,
          vdot: isNovice ? 28 : (form.vdot ?? 33),
        }),
      });

      router.push("/dashboard");
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <StepIndicator currentStep={step} isNovice={isNovice} />

      <div className="min-h-[450px]">
        {/* ── STEP 1: Welcome & Goals ─────────────────────────────────── */}
        {step === 1 && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <header>
              <h1 className="text-3xl font-black text-white tracking-tight mb-2">Welcome to Runshift</h1>
              <p className="text-white/40">Let&apos;s build your perfect training program.</p>
            </header>

            <section className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-black uppercase tracking-widest text-white/30 ml-1">First Name</label>
                  <input
                    type="text"
                    value={form.firstName}
                    onChange={e => setForm({ ...form, firstName: e.target.value })}
                    className={`w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white outline-none focus:border-teal-500/50 transition-all ${FORM_CONTROL_TW}`}
                    placeholder="Enter your name"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-black uppercase tracking-widest text-white/30 ml-1">Nickname</label>
                  <input
                    type="text"
                    value={form.nickname}
                    onChange={e => setForm({ ...form, nickname: e.target.value })}
                    className={`w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white outline-none focus:border-teal-500/50 transition-all ${FORM_CONTROL_TW}`}
                    placeholder="Optional"
                  />
                </div>
              </div>
            </section>

            <section className="space-y-4">
              <p className="text-xs font-black uppercase tracking-widest text-white/30 ml-1">Experience Level</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {(Object.entries(LEVEL_DETAILS) as [Level, typeof LEVEL_DETAILS["NOVICE"]][]).map(([key, info]) => (
                  <CardOption 
                    key={key}
                    selected={form.experienceLevel === key}
                    title={info.title}
                    subtitle={info.desc}
                    onClick={() => setForm({ ...form, experienceLevel: key })}
                  />
                ))}
              </div>
              
              {isNovice && (
                <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-start gap-3 mt-4 animate-in zoom-in-95 duration-300">
                  <Info className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-blue-200/80 leading-relaxed">
                    <strong>Novice plans</strong> focus purely on time-on-feet and effort (RPE). Advanced pace and heart rate metrics will be disabled to keep your foundation-building simple.
                  </p>
                </div>
              )}
            </section>

            <section className="space-y-4">
              <p className="text-xs font-black uppercase tracking-widest text-white/30 ml-1">What are you training for?</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {(["5K", "10K", "HALF", "FULL"] as GoalRace[])
                  .filter(goal => !(isNovice && (goal === "HALF" || goal === "FULL")))
                  .map(goal => (
                    <button
                      key={goal}
                      type="button"
                      onClick={() => setForm({ ...form, goalRace: goal })}
                      className={`py-3 px-2 rounded-xl border-2 transition-all font-bold text-xs ${
                        form.goalRace === goal ? "border-teal-500 bg-teal-500/10 text-white" : "border-white/5 bg-white/5 text-white/30"
                      }`}
                    >
                      {goal === "HALF" ? "HALF MAR" : goal === "FULL" ? "MARATHON" : goal}
                    </button>
                  ))}
              </div>
              {isNovice && (
                <p className="text-[10px] text-teal-400/80 font-medium ml-1">
                  Novice plans are restricted to 5k and 10k to ensure safe, injury-free progression.
                </p>
              )}
            </section>

            <section className="space-y-4 pb-8">
              <p className="text-xs font-black uppercase tracking-widest text-white/30 ml-1">Plan Length</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {([8, 12, 16, 20] as const).map(weeks => (
                  <button
                    key={weeks}
                    type="button"
                    onClick={() => setForm({ ...form, planLengthWeeks: weeks })}
                    className={`py-3 px-2 rounded-xl border-2 transition-all font-bold text-xs ${
                      form.planLengthWeeks === weeks ? "border-teal-500 bg-teal-500/10 text-white" : "border-white/5 bg-white/5 text-white/30"
                    }`}
                  >
                    {weeks} WEEKS
                  </button>
                ))}
              </div>
            </section>
          </div>
        )}

        {/* ── STEP 2: Schedule ────────────────────────────────────────── */}
        {step === 2 && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <header>
              <h1 className="text-3xl font-black text-white tracking-tight mb-2">Weekly Schedule</h1>
              <p className="text-white/40">Tell us when you&apos;re available to train.</p>
            </header>

            <section className="space-y-4">
              <p className="text-xs font-black uppercase tracking-widest text-white/30 ml-1">Training Days (Select 2-6)</p>
              <div className="grid grid-cols-7 gap-2">
                {DAYS.map(day => {
                  const selected = form.trainingDays.includes(day);
                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => {
                        const next = selected ? form.trainingDays.filter(d => d !== day) : [...form.trainingDays, day];
                        if (next.length <= 6) setForm({ ...form, trainingDays: next });
                      }}
                      className={`h-12 rounded-xl border-2 transition-all font-black text-[10px] uppercase ${
                        selected ? "border-teal-500 bg-teal-500/10 text-white" : "border-white/5 bg-white/5 text-white/30"
                      }`}
                    >
                      {DAY_LABEL[day]}
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="space-y-4">
              <p className="text-xs font-black uppercase tracking-widest text-white/30 ml-1">Long Run Day</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {sortedTrainingDays.map(day => (
                  <CardOption
                    key={day}
                    selected={form.longRunDay === day}
                    title={DAY_LABEL[day].toUpperCase()}
                    subtitle="Sustained Effort"
                    onClick={() => setForm({ ...form, longRunDay: day })}
                  />
                ))}
              </div>
              {scheduleWarnings.length > 0 && (
                <div className="mt-4 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
                  {scheduleWarnings.map(w => <p key={w} className="text-xs text-amber-200/70">⚠️ {w}</p>)}
                </div>
              )}
            </section>
          </div>
        )}

        {/* ── STEP 3: Fitness (Skipped for Novice) ─────────────────────── */}
        {step === 3 && !isNovice && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <header>
              <h1 className="text-3xl font-black text-white tracking-tight mb-2">Fitness Baseline</h1>
              <p className="text-white/40">We use VDOT to calibrate your specific pace zones.</p>
            </header>

            <VdotCalculator
              maxHR={form.maxHR}
              onMaxHRChange={hr => setForm({ ...form, maxHR: hr })}
              isNovice={false}
              onApply={v => setForm({ ...form, vdot: v })}
              onFitnessSave={p => setForm({ ...form, vdot: p.vdot, maxHR: p.maxHR })}
            />

            <section className="space-y-4 pt-4 border-t border-white/5">
              <p className="text-xs font-black uppercase tracking-widest text-white/30 ml-1">Goal Finish Time (Optional)</p>
              <div className="flex items-center gap-4">
                <div className="flex-1 space-y-1.5">
                  <input
                    type="number"
                    value={targetTime.hours}
                    onChange={e => setTargetTime({ ...targetTime, hours: e.target.value })}
                    className={`w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white font-mono text-center ${FORM_CONTROL_TW}`}
                  />
                  <p className="text-[10px] text-center text-white/30 uppercase font-black">Hours</p>
                </div>
                <div className="flex-1 space-y-1.5">
                  <input
                    type="number"
                    value={targetTime.mins}
                    onChange={e => setTargetTime({ ...targetTime, mins: e.target.value })}
                    className={`w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white font-mono text-center ${FORM_CONTROL_TW}`}
                  />
                  <p className="text-[10px] text-center text-white/30 uppercase font-black">Minutes</p>
                </div>
              </div>
            </section>

            <button 
              className="text-xs text-white/30 underline block mx-auto pt-4 hover:text-white"
              onClick={() => setSkipFitness(true)}
            >
              I&apos;ll enter these metrics later
            </button>
          </div>
        )}

        {/* ── STEP 4: Review ──────────────────────────────────────────── */}
        {step === 4 && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <header>
              <h1 className="text-3xl font-black text-white tracking-tight mb-2">Ready to Launch</h1>
              <p className="text-white/40">Review your settings before we generate your program.</p>
            </header>

            <div className="rounded-3xl border border-white/10 bg-white/5 p-8 space-y-6">
              <div className="grid grid-cols-2 gap-8">
                <div>
                  <p className="text-[10px] font-black text-white/30 uppercase tracking-widest mb-1">Target</p>
                  <p className="text-lg font-bold text-white">{form.goalRace} Race</p>
                  <p className="text-xs text-white/40">{form.planLengthWeeks} Weeks</p>
                </div>
                <div>
                  <p className="text-[10px] font-black text-white/30 uppercase tracking-widest mb-1">Tier</p>
                  <p className="text-lg font-bold text-teal-400">{form.experienceLevel}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black text-white/30 uppercase tracking-widest mb-1">Schedule</p>
                  <p className="text-sm font-medium text-white">{form.trainingDays.length} Days / Week</p>
                  <p className="text-xs text-white/40">Long Run: {form.longRunDay ? DAY_LABEL[form.longRunDay] : "-"}</p>
                </div>
                {!isNovice && (
                  <div>
                    <p className="text-[10px] font-black text-white/30 uppercase tracking-widest mb-1">Fitness</p>
                    <p className="text-sm font-medium text-white">VDOT {form.vdot ?? "Manual"}</p>
                    <p className="text-xs text-white/40">Max HR: {form.maxHR} bpm</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── NAVIGATION ────────────────────────────────────────────────── */}
      <footer className="mt-12 flex items-center justify-between gap-4 pt-8 border-t border-white/5">
        <button
          type="button"
          onClick={handleBack}
          disabled={step === 1 || saving}
          className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold text-white/40 hover:text-white transition-all disabled:opacity-0"
        >
          <ChevronLeft className="w-4 h-4" /> Back
        </button>

        {step < 4 ? (
          <button
            type="button"
            onClick={handleNext}
            disabled={!canNext || saving}
            className="flex items-center gap-2 px-8 py-3 rounded-xl bg-white text-black text-sm font-black hover:bg-teal-400 hover:scale-105 transition-all disabled:opacity-30 disabled:hover:scale-100"
          >
            Next <ChevronRight className="w-4 h-4" />
          </button>
        ) : (
          <button
            type="button"
            onClick={complete}
            disabled={saving}
            className="px-10 py-4 rounded-2xl bg-teal-500 text-black text-base font-black hover:bg-teal-400 hover:scale-105 transition-all shadow-xl shadow-teal-500/20 disabled:opacity-50"
          >
            {saving ? "Generating..." : "Generate My Training Plan →"}
          </button>
        )}
      </footer>
    </div>
  );
}
