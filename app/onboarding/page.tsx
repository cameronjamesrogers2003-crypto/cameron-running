"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Day, PlanConfig } from "@/data/trainingPlan";
import { useSettings } from "@/context/SettingsContext";
import { getDefaultLongRunDay } from "@/lib/generatePlan";
import VdotCalculator from "@/components/VdotCalculator";

type Level = "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
type GoalRace = "HALF" | "FULL";

const DAYS: Day[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const DAY_LABEL: Record<Day, string> = {
  mon: "Mon",
  tue: "Tue",
  wed: "Wed",
  thu: "Thu",
  fri: "Fri",
  sat: "Sat",
  sun: "Sun",
};

const LEVEL_COPY: Record<Level, string> = {
  BEGINNER: "0–12 months running. Conservative progression.",
  INTERMEDIATE: "1–3 years running. Balanced mix of sessions.",
  ADVANCED: "3+ years running. High intensity from week 1.",
};

function CardOption({
  selected,
  title,
  subtitle,
  onClick,
  badge,
}: {
  selected: boolean;
  title: string;
  subtitle: string;
  onClick: () => void;
  badge?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-left rounded-xl p-4 border transition"
      style={{
        borderColor: selected ? "rgba(45,212,191,0.45)" : "rgba(255,255,255,0.12)",
        background: selected ? "rgba(45,212,191,0.1)" : "rgba(255,255,255,0.03)",
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-white">{title}</p>
        {badge && (
          <span
            className="text-[10px] px-2 py-0.5 rounded-full"
            style={{ background: "rgba(45,212,191,0.2)", color: "#5eead4" }}
          >
            {badge}
          </span>
        )}
      </div>
      <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>{subtitle}</p>
    </button>
  );
}

function computeLockedWeeksFromPlan(planStartIso: string | null, maxWeek: number): number[] {
  if (!planStartIso || maxWeek <= 0) return [];
  const planStart = new Date(planStartIso);
  if (Number.isNaN(planStart.getTime())) return [];
  const now = new Date();
  const todayAestYmd = new Intl.DateTimeFormat("en-CA", { timeZone: "Australia/Brisbane" }).format(now);
  const locked: number[] = [];
  for (let week = 1; week <= maxWeek; week++) {
    const weekEnd = new Date(planStart.getTime() + week * 7 * 24 * 60 * 60 * 1000);
    const weekEndAestYmd = new Intl.DateTimeFormat("en-CA", { timeZone: "Australia/Brisbane" }).format(weekEnd);
    if (weekEndAestYmd < todayAestYmd) locked.push(week);
  }
  return locked;
}

export default function OnboardingPage() {
  const router = useRouter();
  const { settings, updateSettings } = useSettings();

  const [step, setStep] = useState(1);
  const [goalRace, setGoalRace] = useState<GoalRace | null>((settings.goalRace as GoalRace | null) ?? null);
  const [level, setLevel] = useState<Level | null>((settings.experienceLevel as Level | null) ?? null);
  const [planLengthWeeks, setPlanLengthWeeks] = useState<12 | 16 | 20>((settings.planLengthWeeks as 12 | 16 | 20 | null) ?? 16);
  const [calculatedVdot, setCalculatedVdot] = useState<number | null>(null);
  const [suggestedLevel, setSuggestedLevel] = useState<Level | null>(null);
  const [skipFitnessStep, setSkipFitnessStep] = useState(false);
  const [targetHours, setTargetHours] = useState<number>(1);
  const [targetMinutes, setTargetMinutes] = useState<number>(55);
  const [skipFinishTime, setSkipFinishTime] = useState(false);
  const [trainingDays, setTrainingDays] = useState<Day[]>(() => {
    try {
      const parsed = settings.trainingDays ? JSON.parse(settings.trainingDays) as unknown : [];
      if (Array.isArray(parsed)) return parsed.filter((d): d is Day => DAYS.includes(d as Day));
    } catch {}
    return ["wed", "sat", "sun"];
  });
  const [longRunDay, setLongRunDay] = useState<Day | null>(() => {
    const value = settings.longRunDay;
    return value && DAYS.includes(value as Day) ? (value as Day) : null;
  });
  const [saving, setSaving] = useState(false);

  const effectiveLevelForRecommendation = level ?? suggestedLevel;
  const recommendedLength =
    effectiveLevelForRecommendation === "BEGINNER"
      ? 20
      : effectiveLevelForRecommendation === "ADVANCED"
        ? 12
        : 16;

  const sortedTrainingDays = useMemo(
    () => [...trainingDays].sort((a, b) => DAYS.indexOf(a) - DAYS.indexOf(b)),
    [trainingDays],
  );

  const effectiveLongRunDay = useMemo<Day | null>(() => {
    if (sortedTrainingDays.length < 2) return null;
    if (longRunDay && sortedTrainingDays.includes(longRunDay)) return longRunDay;
    return getDefaultLongRunDay(sortedTrainingDays);
  }, [longRunDay, sortedTrainingDays]);

  const canNext = (() => {
    if (step === 1) return goalRace != null;
    if (step === 2) return level != null;
    if (step === 3) return [12, 16, 20].includes(planLengthWeeks);
    if (step === 4) return skipFitnessStep || calculatedVdot != null;
    if (step === 5) return skipFinishTime || (targetHours >= 0 && targetMinutes >= 0 && targetMinutes < 60);
    if (step === 6) return trainingDays.length >= 2 && trainingDays.length <= 6;
    if (step === 7) return sortedTrainingDays.length >= 2 && effectiveLongRunDay != null;
    return true;
  })();

  function toggleDay(day: Day) {
    setTrainingDays((prev) => {
      if (prev.includes(day)) return prev.filter((d) => d !== day);
      if (prev.length >= 6) return prev;
      return [...prev, day];
    });
  }

  async function complete() {
    if (!level || !goalRace || trainingDays.length < 2) return;
    setSaving(true);
    const finishMins = skipFinishTime ? null : (targetHours * 60 + targetMinutes);
    const planConfig: PlanConfig = {
      level,
      goal: goalRace === "FULL" ? "full" : "hm",
      weeks: planLengthWeeks,
      days: sortedTrainingDays,
      longRunDay: effectiveLongRunDay ?? undefined,
      vdot: calculatedVdot ?? settings.currentVdot,
    };
    try {
      await updateSettings({
        goalRace,
        experienceLevel: level,
        planLengthWeeks,
        trainingDays: JSON.stringify(sortedTrainingDays),
        longRunDay: effectiveLongRunDay,
        targetFinishTime: finishMins,
      });

      const token = process.env.NEXT_PUBLIC_PLANS_API_TOKEN;
      let lockedWeeks: number[] = [];
      try {
        const existingResp = await fetch("/api/plans/current", {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (existingResp.ok) {
          const existing = await existingResp.json() as { plan?: Array<{ week: number }> } | null;
          const maxWeek = existing?.plan?.reduce((m, w) => Math.max(m, w.week), 0) ?? 0;
          lockedWeeks = computeLockedWeeksFromPlan(settings.planStartDate, maxWeek);
        }
      } catch {}

      await fetch("/api/plans/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ ...planConfig, lockedWeeks }),
      });

      router.push("/dashboard");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <p className="text-[11px] sm:text-xs uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
        Step {Math.min(step, 7)} of 7
      </p>
      {step === 1 && (
        <section className="space-y-3">
          <h1 className="text-2xl font-bold text-white">What are you training for?</h1>
          <div className="grid sm:grid-cols-2 gap-3">
            <CardOption selected={goalRace === "HALF"} title="HALF MARATHON" subtitle="21.1 km" onClick={() => setGoalRace("HALF")} />
            <CardOption selected={goalRace === "FULL"} title="FULL MARATHON" subtitle="42.2 km" onClick={() => setGoalRace("FULL")} />
          </div>
        </section>
      )}
      {step === 2 && (
        <section className="space-y-3">
          <h1 className="text-2xl font-bold text-white">How long have you been running?</h1>
          <div className="grid sm:grid-cols-3 gap-3">
            {(["BEGINNER", "INTERMEDIATE", "ADVANCED"] as const).map((opt) => (
              <CardOption key={opt} selected={level === opt} title={opt} subtitle={LEVEL_COPY[opt]} onClick={() => setLevel(opt)} />
            ))}
          </div>
        </section>
      )}
      {step === 3 && (
        <section className="space-y-3">
          <h1 className="text-2xl font-bold text-white">How many weeks do you have?</h1>
          <div className="grid sm:grid-cols-3 gap-3">
            {([12, 16, 20] as const).map((weeks) => (
              <CardOption
                key={weeks}
                selected={planLengthWeeks === weeks}
                title={`${weeks} WEEKS`}
                subtitle={weeks === 12 ? "For runners with a race soon or a strong base." : weeks === 16 ? "Standard plan length. Recommended for most runners." : "Extra base building time. Ideal for beginners."}
                badge={recommendedLength === weeks ? "Recommended" : undefined}
                onClick={() => setPlanLengthWeeks(weeks)}
              />
            ))}
          </div>
        </section>
      )}
      {step === 4 && (
        <section className="space-y-3">
          <h1 className="text-2xl font-bold text-white">What&apos;s your current fitness level?</h1>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Enter a recent race time or timed 5K to calculate your VDOT score.
          </p>
          <VdotCalculator
            onApply={(nextVdot) => {
              setCalculatedVdot(nextVdot);
            }}
            onLevelSuggested={(nextLevel) => {
              setSuggestedLevel(nextLevel);
            }}
          />
          {suggestedLevel && (
            <div className="rounded-md border border-teal-400/30 bg-teal-400/10 p-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-teal-100">
                Based on your time, we suggest: <strong>{suggestedLevel}</strong>
              </p>
              <button
                type="button"
                className="min-h-11 rounded-md px-3 py-2 text-sm font-semibold bg-teal-600 text-white"
                onClick={() => setLevel(suggestedLevel)}
              >
                Apply to experience level
              </button>
            </div>
          )}
          <button className="text-sm underline" onClick={() => setSkipFitnessStep(true)} type="button">
            Skip — I&apos;ll enter my VDOT manually
          </button>
        </section>
      )}
      {step === 5 && (
        <section className="space-y-3">
          <h1 className="text-2xl font-bold text-white">What&apos;s your goal finish time?</h1>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Don&apos;t worry if you&apos;re unsure — you can update this later in Settings.
          </p>
          <div className="flex items-center gap-2">
            <input type="number" min={0} value={targetHours} onChange={(e) => setTargetHours(Number(e.target.value))} className="w-24 rounded px-3 py-2 bg-black/20 border border-white/10 text-white" />
            <span>hours</span>
            <input type="number" min={0} max={59} value={targetMinutes} onChange={(e) => setTargetMinutes(Number(e.target.value))} className="w-24 rounded px-3 py-2 bg-black/20 border border-white/10 text-white" />
            <span>minutes</span>
          </div>
          <button className="text-sm underline" onClick={() => setSkipFinishTime(true)} type="button">Skip for now</button>
        </section>
      )}
      {step === 6 && (
        <section className="space-y-3">
          <h1 className="text-2xl font-bold text-white">Which days can you train?</h1>
          <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
            {DAYS.map((day) => {
              const selected = trainingDays.includes(day);
              return (
                <button
                  type="button"
                  key={day}
                  onClick={() => toggleDay(day)}
                  className="rounded-md min-h-11 py-2 text-[11px] sm:text-sm border"
                  style={{
                    borderColor: selected ? "rgba(45,212,191,0.45)" : "rgba(255,255,255,0.12)",
                    background: selected ? "rgba(45,212,191,0.15)" : "rgba(255,255,255,0.03)",
                    color: selected ? "#5eead4" : "#fff",
                  }}
                >
                  {DAY_LABEL[day]}
                </button>
              );
            })}
          </div>
          {trainingDays.length > 6 && <p className="text-xs text-orange-300">Running every day increases injury risk. Maximum 6 days recommended.</p>}
          {trainingDays.length < 2 && <p className="text-xs text-orange-300">Select at least 2 training days.</p>}
        </section>
      )}
      {step === 7 && (
        <section className="space-y-3">
          <h1 className="text-2xl font-bold text-white">Which day is your long run?</h1>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            We&apos;ll build your training schedule around this day.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {sortedTrainingDays.map((day) => (
              <button
                type="button"
                key={day}
                onClick={() => setLongRunDay(day)}
                className="rounded-md min-h-11 py-2 text-[11px] sm:text-sm border"
                style={{
                  borderColor: effectiveLongRunDay === day ? "rgba(45,212,191,0.45)" : "rgba(255,255,255,0.12)",
                  background: effectiveLongRunDay === day ? "rgba(45,212,191,0.15)" : "rgba(255,255,255,0.03)",
                  color: effectiveLongRunDay === day ? "#5eead4" : "#fff",
                }}
              >
                {DAY_LABEL[day]}
              </button>
            ))}
          </div>
        </section>
      )}
      {step > 7 && (
        <section className="space-y-3">
          <h1 className="text-2xl font-bold text-white">Your plan is ready.</h1>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm space-y-1">
            <p><span style={{ color: "var(--text-muted)" }}>Goal race:</span> {goalRace === "FULL" ? "FULL MARATHON" : "HALF MARATHON"}</p>
            <p><span style={{ color: "var(--text-muted)" }}>Experience level:</span> {level}</p>
            <p><span style={{ color: "var(--text-muted)" }}>Plan length:</span> {planLengthWeeks} weeks</p>
            <p><span style={{ color: "var(--text-muted)" }}>Training days:</span> {sortedTrainingDays.map((d) => DAY_LABEL[d]).join(", ")}</p>
            <p><span style={{ color: "var(--text-muted)" }}>Long run day:</span> {effectiveLongRunDay ? DAY_LABEL[effectiveLongRunDay] : "Not set"}</p>
            <p><span style={{ color: "var(--text-muted)" }}>Start date:</span> {settings.planStartDate?.slice(0, 10) ?? "Not set"}</p>
          </div>
          <button
            type="button"
            onClick={complete}
            disabled={saving}
            className="rounded-md px-4 py-2 bg-teal-600 text-white text-sm font-semibold disabled:opacity-60"
          >
            {saving ? "Saving..." : "Start Training →"}
          </button>
        </section>
      )}

      <div className="flex flex-col sm:flex-row justify-between gap-2 pt-3">
        <button
          type="button"
          onClick={() => setStep((s) => Math.max(1, s - 1))}
          disabled={step === 1}
          className="rounded-md min-h-11 px-4 py-2 border border-white/15 text-sm disabled:opacity-50 w-full sm:w-auto"
        >
          Back
        </button>
        <button
          type="button"
          onClick={() => setStep((s) => Math.min(8, s + 1))}
          disabled={!canNext || step > 7}
          className="rounded-md min-h-11 px-4 py-2 bg-white/10 text-sm disabled:opacity-50 w-full sm:w-auto"
        >
          Next
        </button>
      </div>
    </div>
  );
}
