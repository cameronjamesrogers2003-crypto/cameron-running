"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { encouragingCheckinLine, noviceSessionTitle } from "@/lib/noviceUiCopy";
import { formatMinPerKm } from "@/lib/noviceFormat";
import type { Session } from "@/data/trainingPlan";

type Completion = "full" | "partial" | "skip";
type SkipReason = "illness" | "injury" | "time" | "motivation" | "other";

export type NoviceCheckinModalProps = {
  open: boolean;
  onClose: () => void;
  session: Session | null;
  weekNumber: number;
  plannedDurationMin: number;
  stravaActivityId: string | null;
  strava?: {
    distanceKm: number;
    durationMin: number;
    avgPaceSecPerKm: number;
  } | null;
  isFinalSessionOfWeek: boolean;
  onOptimistic: (sessionId: string) => void;
  onRevertOptimistic: (sessionId: string) => void;
};

const DAY_NAMES: Record<string, string> = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
  sun: "Sunday",
};

const btnPrimary =
  "rounded-xl bg-[#2d6a4f] text-white font-semibold py-3 px-4 text-center w-full hover:opacity-95 transition";
const btnSecondary =
  "rounded-xl border-2 border-[#2d6a4f] text-[#2d6a4f] font-semibold py-3 px-4 text-center w-full bg-white hover:bg-[#f8fafc] transition";
const btnMuted = "rounded-xl bg-[#f1f5f9] text-[#475569] font-medium py-3 px-4 text-center w-full hover:bg-[#e2e8f0] transition";

export function NoviceCheckinModal({
  open,
  onClose,
  session,
  weekNumber,
  plannedDurationMin,
  stravaActivityId,
  strava,
  isFinalSessionOfWeek,
  onOptimistic,
  onRevertOptimistic,
}: NoviceCheckinModalProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [completion, setCompletion] = useState<Completion | null>(null);
  const [userRpe, setUserRpe] = useState<number | null>(null);
  const [skipReason, setSkipReason] = useState<SkipReason | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submittedRef = useRef(false);

  const reset = useCallback(() => {
    setStep(1);
    setCompletion(null);
    setUserRpe(null);
    setSkipReason(null);
    setSaving(false);
    setError(null);
    submittedRef.current = false;
  }, []);

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [onClose, reset]);

  const st = session?.type === "interval" ? "easy" : (session?.type as "easy" | "long" | "tempo" | undefined);
  const plannedKm = session?.targetDistanceKm ?? 0;

  const runSubmit = useCallback(async () => {
    if (!session || !st || !completion) return;
    if (completion === "skip" && !skipReason) return;
    if ((completion === "full" || completion === "partial") && userRpe == null) return;
    setSaving(true);
    setError(null);
    onOptimistic(session.id);

    const completed = completion === "full" || completion === "partial";
    const actualKm =
      strava && completion === "partial"
        ? Math.min(plannedKm, strava.distanceKm)
        : strava && completion === "full"
          ? strava.distanceKm
          : null;

    const body = {
      sessionId: session.id,
      weekNumber,
      sessionType: st,
      plannedDistanceKm: plannedKm,
      plannedDurationMin,
      stravaActivityId: strava ? stravaActivityId : null,
      actualDistanceKm: actualKm,
      actualDurationMin: strava ? strava.durationMin : null,
      averagePaceSecPerKm: strava ? strava.avgPaceSecPerKm : null,
      averageHeartRate: null,
      maxHeartRate: null,
      perceivedEffortFromHr: null,
      completed,
      userRpe: completion === "skip" ? 5 : userRpe ?? 5,
      skippedReason: completion === "skip" ? skipReason : null,
    };

    try {
      const res = await fetch("/api/novice/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? "Save failed");
      }
      if (isFinalSessionOfWeek) {
        const ev = await fetch("/api/novice/evaluate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ weekNumber }),
        });
        if (!ev.ok) console.warn("[novice checkin] evaluate failed", await ev.text());
      }
      handleClose();
    } catch (e) {
      onRevertOptimistic(session.id);
      setError(e instanceof Error ? e.message : "Something went wrong. Try again.");
      setSaving(false);
    }
  }, [
    completion,
    handleClose,
    isFinalSessionOfWeek,
    onOptimistic,
    onRevertOptimistic,
    plannedDurationMin,
    plannedKm,
    session,
    skipReason,
    st,
    strava,
    stravaActivityId,
    userRpe,
    weekNumber,
  ]);

  useEffect(() => {
    if (step !== 3 || !session || !completion) return;
    if (completion === "skip" && !skipReason) return;
    if ((completion === "full" || completion === "partial") && userRpe == null) return;
    if (submittedRef.current) return;
    submittedRef.current = true;
    void runSubmit();
  }, [step, session, completion, skipReason, userRpe, runSubmit]);

  if (!open || !session || !st) return null;

  const title = noviceSessionTitle(st);
  const day = DAY_NAMES[session.day] ?? session.day;

  const summaryLine = encouragingCheckinLine({
    completed: completion === "full" || completion === "partial",
    partial: completion === "partial",
    skipped: completion === "skip",
    injurySkip: completion === "skip" && skipReason === "injury",
    userRpe: userRpe,
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-md rounded-t-3xl sm:rounded-3xl bg-[#faf8f5] p-5 sm:p-6 shadow-xl max-h-[90vh] overflow-y-auto">
        {step === 1 && (
          <div className="space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[#64748b]">{title}</p>
              <p className="text-lg font-semibold text-[#1e293b]">{day}</p>
            </div>
            {strava ? (
              <div className="rounded-xl border border-black/[0.06] bg-white p-4 text-sm text-[#334155] space-y-1">
                <p className="font-semibold text-[#1e293b]">Strava detected</p>
                <p>
                  Distance: {strava.distanceKm} km (planned: {plannedKm} km)
                </p>
                <p>Duration: {Math.round(strava.durationMin)} min</p>
                <p>Avg pace: {formatMinPerKm(strava.avgPaceSecPerKm)}</p>
              </div>
            ) : (
              <p className="text-sm text-[#475569]">Planned distance: {plannedKm} km</p>
            )}
            <p className="text-sm font-medium text-[#1e293b]">Did you complete this session?</p>
            <div className="flex flex-col gap-2">
              <button type="button" className={btnPrimary} onClick={() => { setCompletion("full"); setStep(2); }}>
                Yes, completed
              </button>
              <button type="button" className={btnSecondary} onClick={() => { setCompletion("partial"); setStep(2); }}>
                Partial — I stopped early
              </button>
              <button type="button" className={btnMuted} onClick={() => { setCompletion("skip"); setStep(2); }}>
                No — skip this one
              </button>
            </div>
            <button type="button" className="text-sm text-[#64748b] underline" onClick={handleClose}>
              Close
            </button>
          </div>
        )}

        {step === 2 && completion !== "skip" && (
          <div className="space-y-4">
            <p className="text-sm font-medium text-[#1e293b]">How hard did this feel?</p>
            <div className="flex flex-wrap justify-center gap-1.5">
              {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => {
                    setUserRpe(n);
                    setStep(3);
                  }}
                  className={`h-10 w-9 rounded-lg text-sm font-semibold border transition ${
                    userRpe === n ? "border-[#2d6a4f] bg-[#ecfdf5] text-[#14532d]" : "border-[#e2e8f0] bg-white text-[#475569]"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
            <p className="text-center text-xs text-[#94a3b8]">Easy ←————————————→ Maximum</p>
            <button type="button" className="text-sm text-[#64748b] underline" onClick={() => setStep(1)}>
              Back
            </button>
          </div>
        )}

        {step === 2 && completion === "skip" && (
          <div className="space-y-3">
            <p className="text-sm font-medium text-[#1e293b]">Why did you skip?</p>
            <div className="flex flex-col gap-2">
              {(
                [
                  ["illness", "Illness"],
                  ["injury", "Injury"],
                  ["time", "No time"],
                  ["motivation", "Motivation"],
                  ["other", "Other"],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    setSkipReason(key);
                    setStep(3);
                  }}
                  className={`rounded-xl border px-4 py-3 text-left text-sm font-medium transition ${
                    key === "injury"
                      ? "border-[#f59e0b] bg-[#fffbeb] text-[#92400e]"
                      : "border-[#e2e8f0] bg-white text-[#334155]"
                  }`}
                >
                  {label}
                  {key === "injury" ? (
                    <span className="mt-1 block text-xs font-normal text-[#b45309]">
                      We will pause your plan and check in with you.
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
            <button type="button" className="text-sm text-[#64748b] underline" onClick={() => setStep(1)}>
              Back
            </button>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <p className="text-lg font-semibold text-[#166534]">{title} logged ✓</p>
            <p className="text-sm text-[#475569] leading-relaxed">{summaryLine}</p>
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            {saving ? <p className="text-sm text-[#94a3b8]">Saving…</p> : null}
            {!saving && !error ? (
              <button type="button" className={btnPrimary} onClick={handleClose}>
                Continue
              </button>
            ) : null}
            {error ? (
              <button type="button" className={btnSecondary} onClick={() => { submittedRef.current = false; void runSubmit(); }}>
                Retry
              </button>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
