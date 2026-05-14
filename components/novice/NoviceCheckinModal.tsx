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
  /** Dark modal shell to match Training Program hub. */
  surface?: "cream" | "program";
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
  surface = "cream",
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

  const prog = surface === "program";
  const btnPrimaryCls = prog
    ? "rounded-xl font-semibold py-3 px-4 text-center w-full transition border text-white"
    : btnPrimary;
  const btnPrimaryStyle = prog
    ? { background: "rgba(45,212,191,0.18)", borderColor: "rgba(45,212,191,0.45)", borderWidth: 1, borderStyle: "solid" as const }
    : undefined;
  const btnSecondaryCls = prog
    ? "rounded-xl font-semibold py-3 px-4 text-center w-full transition border"
    : btnSecondary;
  const btnSecondaryStyle = prog
    ? {
        borderColor: "rgba(45,212,191,0.45)",
        borderWidth: 2,
        borderStyle: "solid" as const,
        color: "var(--accent)",
        background: "transparent",
      }
    : undefined;
  const btnMutedCls = prog
    ? "rounded-xl font-medium py-3 px-4 text-center w-full transition"
    : btnMuted;
  const btnMutedStyle = prog
    ? { background: "rgba(255,255,255,0.06)", color: "rgba(232,230,224,0.85)" }
    : undefined;

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
      className={
        prog
          ? "fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          : "fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4"
      }
      role="dialog"
      aria-modal="true"
    >
      {prog ? (
        <div
          className="absolute inset-0"
          style={{ background: "rgba(5,6,8,0.78)", backdropFilter: "blur(6px)" }}
          onClick={handleClose}
          aria-hidden
        />
      ) : null}
      <div
        className={
          prog
            ? "relative z-10 w-full max-w-md rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 max-h-[90vh] overflow-y-auto border"
            : "w-full max-w-md rounded-t-3xl sm:rounded-3xl bg-[#faf8f5] p-5 sm:p-6 shadow-xl max-h-[90vh] overflow-y-auto"
        }
        style={
          prog
            ? {
                background: "#0d0e10",
                borderColor: "rgba(255,255,255,0.08)",
                boxShadow: "0 0 0 1px rgba(255,255,255,0.08), 0 32px 80px rgba(0,0,0,0.65)",
              }
            : undefined
        }
      >
        {step === 1 && (
          <div className="space-y-4">
            <div>
              <p
                className={`text-xs font-semibold uppercase tracking-wide ${prog ? "" : "text-[#64748b]"}`}
                style={prog ? { color: "rgba(232,230,224,0.45)" } : undefined}
              >
                {title}
              </p>
              <p className={`text-lg font-semibold ${prog ? "text-white" : "text-[#1e293b]"}`}>{day}</p>
            </div>
            {strava ? (
              <div
                className={`rounded-xl border p-4 text-sm space-y-1 ${prog ? "" : "border-black/[0.06] bg-white text-[#334155]"}`}
                style={
                  prog
                    ? {
                        borderColor: "rgba(255,255,255,0.08)",
                        background: "rgba(255,255,255,0.04)",
                        color: "rgba(232,230,224,0.88)",
                      }
                    : undefined
                }
              >
                <p className={`font-semibold ${prog ? "text-white" : "text-[#1e293b]"}`}>Strava detected</p>
                <p>
                  Distance: {strava.distanceKm} km (planned: {plannedKm} km)
                </p>
                <p>Duration: {Math.round(strava.durationMin)} min</p>
                <p>Avg pace: {formatMinPerKm(strava.avgPaceSecPerKm)}</p>
              </div>
            ) : (
              <p className="text-sm" style={prog ? { color: "rgba(232,230,224,0.72)" } : { color: "#475569" }}>
                Planned distance: {plannedKm} km
              </p>
            )}
            <p className="text-sm font-medium" style={prog ? { color: "white" } : { color: "#1e293b" }}>
              Did you complete this session?
            </p>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                className={btnPrimaryCls}
                style={btnPrimaryStyle}
                onClick={() => {
                  setCompletion("full");
                  setStep(2);
                }}
              >
                Yes, completed
              </button>
              <button
                type="button"
                className={btnSecondaryCls}
                style={btnSecondaryStyle}
                onClick={() => {
                  setCompletion("partial");
                  setStep(2);
                }}
              >
                Partial — I stopped early
              </button>
              <button
                type="button"
                className={btnMutedCls}
                style={btnMutedStyle}
                onClick={() => {
                  setCompletion("skip");
                  setStep(2);
                }}
              >
                No — skip this one
              </button>
            </div>
            <button
              type="button"
              className="text-sm underline"
              style={{ color: prog ? "rgba(232,230,224,0.55)" : "#64748b" }}
              onClick={handleClose}
            >
              Close
            </button>
          </div>
        )}

        {step === 2 && completion !== "skip" && (
          <div className="space-y-4">
            <p className="text-sm font-medium" style={prog ? { color: "white" } : { color: "#1e293b" }}>
              How hard did this feel?
            </p>
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
                    userRpe === n
                      ? prog
                        ? "border-[var(--accent)] bg-[rgba(45,212,191,0.15)] text-[var(--accent)]"
                        : "border-[#2d6a4f] bg-[#ecfdf5] text-[#14532d]"
                      : prog
                        ? "border-white/10 bg-white/5 text-[rgba(232,230,224,0.85)]"
                        : "border-[#e2e8f0] bg-white text-[#475569]"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
            <p className="text-center text-xs" style={{ color: prog ? "rgba(232,230,224,0.45)" : "#94a3b8" }}>
              Easy ←————————————→ Maximum
            </p>
            <button
              type="button"
              className="text-sm underline"
              style={{ color: prog ? "rgba(232,230,224,0.55)" : "#64748b" }}
              onClick={() => setStep(1)}
            >
              Back
            </button>
          </div>
        )}

        {step === 2 && completion === "skip" && (
          <div className="space-y-3">
            <p className="text-sm font-medium" style={prog ? { color: "white" } : { color: "#1e293b" }}>
              Why did you skip?
            </p>
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
                      ? prog
                        ? "border-[#f59e0b] bg-[rgba(245,180,84,0.1)] text-[#f5b454]"
                        : "border-[#f59e0b] bg-[#fffbeb] text-[#92400e]"
                      : prog
                        ? "border-white/10 bg-white/5 text-[rgba(232,230,224,0.9)]"
                        : "border-[#e2e8f0] bg-white text-[#334155]"
                  }`}
                >
                  {label}
                  {key === "injury" ? (
                    <span
                      className={`mt-1 block text-xs font-normal ${prog ? "text-[#fbbf24]" : "text-[#b45309]"}`}
                    >
                      We will pause your plan and check in with you.
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="text-sm underline"
              style={{ color: prog ? "rgba(232,230,224,0.55)" : "#64748b" }}
              onClick={() => setStep(1)}
            >
              Back
            </button>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <p className="text-lg font-semibold" style={{ color: prog ? "#5DCAA5" : "#166534" }}>
              {title} logged ✓
            </p>
            <p className="text-sm leading-relaxed" style={prog ? { color: "rgba(232,230,224,0.72)" } : { color: "#475569" }}>
              {summaryLine}
            </p>
            {error ? <p className="text-sm text-red-500">{error}</p> : null}
            {saving ? (
              <p className="text-sm" style={{ color: prog ? "rgba(232,230,224,0.45)" : "#94a3b8" }}>
                Saving…
              </p>
            ) : null}
            {!saving && !error ? (
              <button type="button" className={btnPrimaryCls} style={btnPrimaryStyle} onClick={handleClose}>
                Continue
              </button>
            ) : null}
            {error ? (
              <button
                type="button"
                className={btnSecondaryCls}
                style={btnSecondaryStyle}
                onClick={() => {
                  submittedRef.current = false;
                  void runSubmit();
                }}
              >
                Retry
              </button>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
