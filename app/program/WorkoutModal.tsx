"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { RunTypePill } from "@/components/RunTypePill";
import { getSessionDisplayName } from "@/lib/runTypeStyles";
import type { SessionCardProps } from "./SessionCard";

export type WorkoutModalProps = SessionCardProps & { 
  onClose: () => void;
  sRPE?: number | null;
};

export default function WorkoutModal(props: WorkoutModalProps) {
  const {
    onClose,
    sessionType,
    dayLabel,
    sessionDateStr,
    weekNumber,
    phase,
    targetKm,
    targetPaceStr,
    effortLabel,
    colorBarBg,
    showRating,
    ratingNum,
    ratingBadgeStyle,
    zoneBadge,
    actualKm,
    actualPaceStr,
    runTypeMismatch,
    mismatchNote,
    sessionLabelVariant,
    workoutStructure,
    isNovice,
    runnerLevel,
    sRPE,
  } = props;

  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setMounted(true);
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!mounted) return null;

  const effortChips = workoutStructure.effortGuidance
    .split(" · ")
    .map((s) => s.trim())
    .filter(Boolean);

  const sessionLabel =
    sessionLabelVariant === "today"
      ? { text: "Today", color: "#a5b4fc" }
      : sessionLabelVariant === "startDay"
      ? { text: "Start Day", color: "var(--accent)" }
      : sessionLabelVariant === "missed"
      ? { text: "Missed", color: "#f59e0b" }
      : null;

  // Safety Context: Display a warning if the reported RPE was significantly higher (e.g., +3 points) than the target RPE
  const targetRpeMatch = workoutStructure.effortGuidance.match(/RPE (\d+)/);
  const fallbackRpe =
    isNovice
      ? sessionType === "long"
        ? 4
        : sessionType === "tempo"
          ? 5
          : 3
      : sessionType === "long"
        ? 5
        : 3;
  const targetRpe = targetRpeMatch ? parseInt(targetRpeMatch[1], 10) : fallbackRpe;
  const rpeGap = sRPE != null ? sRPE - targetRpe : 0;
  const showRpeWarning = isNovice && sRPE != null && rpeGap >= 3;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-5"
      style={{ opacity: visible ? 1 : 0, transition: "opacity 0.18s ease" }}
      role="dialog"
      aria-modal="true"
      aria-label={`${getSessionDisplayName(sessionType, runnerLevel ?? null)} session details`}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0"
        style={{ background: "rgba(5,6,8,0.78)", backdropFilter: "blur(6px)" }}
        onClick={onClose}
        aria-hidden
      />

      {/* Sheet / modal */}
      <div
        className="relative z-10 w-full sm:max-w-[620px] flex flex-col rounded-t-[20px] sm:rounded-2xl overflow-hidden"
        style={{
          background: "#0d0e10",
          maxHeight: "93vh",
          boxShadow:
            "0 0 0 1px rgba(255,255,255,0.08), 0 32px 80px rgba(0,0,0,0.65)",
          transform: visible ? "translateY(0)" : "translateY(28px)",
          transition: "transform 0.3s cubic-bezier(0.34,1.06,0.64,1)",
        }}
      >
        {/* Mobile drag handle */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div
            className="w-9 rounded-full"
            style={{ height: "3px", background: "rgba(255,255,255,0.18)" }}
          />
        </div>

        {/* Top colour bar */}
        <div style={{ height: "3px", background: colorBarBg, width: "100%", flexShrink: 0 }} />

        {/* Scrollable body */}
        <div className="overflow-y-auto overscroll-contain flex-1">

          {/* ── Sticky header ─────────────────────────────────────────────── */}
          <div
            className="sticky top-0 z-10 px-5 pt-4 pb-4"
            style={{
              background: "#0d0e10",
              borderBottom: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            {/* Type pill + status badges + close */}
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2 flex-wrap">
                <RunTypePill type={sessionType} size="sm" runnerLevel={runnerLevel ?? null} />
                {sessionLabel && (
                  <span
                    className="text-xs font-semibold px-2 py-0.5 rounded-full"
                    style={{
                      color: sessionLabel.color,
                      background: `${sessionLabel.color}1a`,
                    }}
                  >
                    {sessionLabel.text}
                  </span>
                )}
                {ratingNum != null && ratingBadgeStyle && (
                  <span
                    className="text-xs font-bold px-1.5 py-0.5 rounded"
                    style={ratingBadgeStyle}
                  >
                    {ratingNum.toFixed(1)}
                  </span>
                )}
                {zoneBadge && (
                  <span
                    className="text-xs font-medium px-2 py-0.5 rounded-full"
                    style={{
                      color: zoneBadge.color,
                      background: `${zoneBadge.color}22`,
                      border: `1px solid ${zoneBadge.color}33`,
                    }}
                  >
                    {zoneBadge.label}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={onClose}
                className="shrink-0 p-1.5 rounded-lg transition-colors hover:bg-white/[0.07]"
                style={{ color: "rgba(255,255,255,0.38)" }}
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Day · date · context */}
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 mb-3">
              <span className="text-base font-bold text-white">{dayLabel}</span>
              <span className="text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>
                {sessionDateStr}
              </span>
              <span className="text-xs" style={{ color: "rgba(255,255,255,0.28)" }}>
                · Week {weekNumber} · {phase}
              </span>
            </div>

            {/* Key metrics */}
            <div className="flex items-baseline gap-3 flex-wrap">
              <span className="font-mono font-bold text-2xl sm:text-3xl text-white leading-none">
                {targetKm.toFixed(1)} km
              </span>
              <span
                className="font-mono text-lg sm:text-xl font-semibold leading-none"
                style={{ color: "rgba(255,255,255,0.55)" }}
              >
                {targetPaceStr}
              </span>
              <span
                className="text-xs font-medium px-2 py-1 rounded-full"
                style={{
                  background: "rgba(255,255,255,0.06)",
                  color: "rgba(255,255,255,0.45)",
                }}
              >
                {effortLabel}
              </span>
            </div>

            {/* Actual run */}
            {showRating && actualKm != null && actualPaceStr && (
              <div className="space-y-1.5 mt-2.5 pt-2.5 border-t border-white/5">
                <p
                  className="text-xs font-mono"
                  style={{ color: "rgba(45,212,191,0.78)" }}
                >
                  ✓ Completed · {actualKm.toFixed(1)} km · {actualPaceStr}
                </p>
                {sRPE != null && (
                  <p className="text-xs font-bold text-white/50">
                    Reported Effort: <span className="text-teal-400">RPE {sRPE}</span>
                  </p>
                )}
              </div>
            )}
          </div>

          {/* ── Body ──────────────────────────────────────────────────────── */}
          <div className="px-5 pt-5 pb-8 space-y-6">

            {/* RPE Warning */}
            {showRpeWarning && (
              <div
                className="rounded-xl px-4 py-3 bg-red-500/10 border border-red-500/20"
              >
                <p className="text-xs font-bold text-red-400 mb-1">High Perceived Effort</p>
                <p className="text-xs leading-relaxed text-red-300/80">
                  You reported an RPE of {sRPE}, which is significantly higher than the target RPE of {targetRpe}. 
                  Consider slowing down or taking more walk breaks in your next session to ensure your body is adapting safely.
                </p>
              </div>
            )}

            {/* Mismatch warning */}
            {runTypeMismatch && mismatchNote && (
              <div
                className="rounded-xl px-4 py-3"
                style={{
                  background: "rgba(245,158,11,0.07)",
                  border: "1px solid rgba(245,158,11,0.18)",
                }}
              >
                <p className="text-xs leading-relaxed" style={{ color: "#fbbf24" }}>
                  {mismatchNote}
                </p>
              </div>
            )}

            {/* Purpose */}
            <section>
              <Label>Purpose</Label>
              <p
                className="mt-2 text-sm leading-relaxed"
                style={{ color: "rgba(232,230,224,0.82)" }}
              >
                {workoutStructure.sessionPurpose}
              </p>
              <div
                className="mt-3 rounded-xl px-4 py-3"
                style={{
                  background: "rgba(255,255,255,0.028)",
                  border: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                <p
                  className="text-xs leading-relaxed"
                  style={{ color: "rgba(232,230,224,0.42)" }}
                >
                  {workoutStructure.physiologicalTarget}
                </p>
              </div>
            </section>

            <Rule />

            {/* Workout structure */}
            <section>
              <Label>Workout</Label>
              <div
                className="mt-3 rounded-xl overflow-hidden"
                style={{ border: "1px solid rgba(255,255,255,0.07)" }}
              >
                {[workoutStructure.warmup, workoutStructure.mainSet, workoutStructure.cooldown].map(
                  (sec, i, arr) => (
                    <div
                      key={sec.label}
                      className="flex gap-4 px-4 py-4"
                      style={{
                        borderBottom:
                          i < arr.length - 1
                            ? "1px solid rgba(255,255,255,0.05)"
                            : "none",
                      }}
                    >
                      <span
                        className="w-16 shrink-0 text-right pt-0.5"
                        style={{
                          color: "rgba(232,230,224,0.28)",
                          fontSize: "0.6875rem",
                          fontWeight: 700,
                          textTransform: "uppercase",
                          letterSpacing: "0.08em",
                        }}
                      >
                        {sec.label}
                      </span>
                      <p
                        className="flex-1 min-w-0 text-sm leading-relaxed"
                        style={{ color: "rgba(232,230,224,0.84)" }}
                      >
                        {sec.content}
                      </p>
                    </div>
                  )
                )}
              </div>
            </section>

            <Rule />

            {/* Effort targets */}
            <section>
              <Label>Effort targets</Label>
              <div className="flex flex-wrap gap-2 mt-3">
                {effortChips.map((chip) => (
                  <span
                    key={chip}
                    className="text-xs font-semibold px-3 py-1.5 rounded-full"
                    style={{
                      background: "rgba(45,212,191,0.07)",
                      border: "1px solid rgba(45,212,191,0.18)",
                      color: "rgba(45,212,191,0.92)",
                    }}
                  >
                    {chip}
                  </span>
                ))}
              </div>
            </section>

            {/* Execution tips */}
            {workoutStructure.executionTips.length > 0 && (
              <section>
                <Label>Tips</Label>
                <ul className="mt-2.5 space-y-2.5">
                  {workoutStructure.executionTips.map((tip, i) => (
                    <li
                      key={i}
                      className="flex gap-3 text-sm leading-relaxed"
                      style={{ color: "rgba(232,230,224,0.72)" }}
                    >
                      <span
                        className="shrink-0 mt-0.5 font-bold text-base leading-none"
                        style={{ color: "var(--accent)" }}
                      >
                        ›
                      </span>
                      <span>{tip}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Fueling */}
            {workoutStructure.fuelingNotes && (
              <>
                <Rule />
                <section>
                  <Label>Fueling</Label>
                  <p
                    className="mt-2 text-sm leading-relaxed"
                    style={{ color: "rgba(232,230,224,0.72)" }}
                  >
                    {workoutStructure.fuelingNotes}
                  </p>
                </section>
              </>
            )}

            {/* Fallback */}
            {workoutStructure.fallbackOption && (
              <div
                className="rounded-xl px-4 py-4"
                style={{
                  background: "rgba(245,180,84,0.055)",
                  border: "1px solid rgba(245,180,84,0.16)",
                }}
              >
                <p
                  className="text-xs font-bold uppercase tracking-widest mb-2"
                  style={{ color: "#f5b454", letterSpacing: "0.09em" }}
                >
                  If struggling
                </p>
                <p
                  className="text-sm leading-relaxed"
                  style={{ color: "rgba(245,180,84,0.88)" }}
                >
                  {workoutStructure.fallbackOption}
                </p>
              </div>
            )}

            {/* Post-run recovery */}
            {workoutStructure.postRunRecovery && (
              <section>
                <Label>After</Label>
                <p
                  className="mt-2 text-sm leading-relaxed"
                  style={{ color: "rgba(232,230,224,0.58)" }}
                >
                  {workoutStructure.postRunRecovery}
                </p>
              </section>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function Label({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{
        color: "rgba(232,230,224,0.32)",
        fontSize: "0.6875rem",
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.1em",
      }}
    >
      {children}
    </p>
  );
}

function Rule() {
  return (
    <div style={{ height: "1px", background: "rgba(255,255,255,0.06)" }} />
  );
}
