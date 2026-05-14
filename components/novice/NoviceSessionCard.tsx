"use client";

import { useCallback, useState, type MouseEvent } from "react";
import { NoviceRunWalkIndicator } from "@/components/novice/NoviceRunWalkIndicator";
import { noviceSessionTitle, BRIDGE_RUN_EXPLAINER } from "@/lib/noviceUiCopy";
import { formatProgramDistanceKm } from "@/lib/planDistanceKm";
import type { Session } from "@/data/trainingPlan";
import { Check, AlertCircle } from "lucide-react";

const DAY_NAMES: Record<string, string> = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
  sun: "Sunday",
};

export type CheckinUiState =
  | "not_started"
  | "strava_detected"
  | "checked_in_complete"
  | "checked_in_incomplete"
  | "missed";

export type NoviceCheckinSummary = {
  completed: boolean;
  userRpe: number;
  skippedReason: string | null;
  actualDistanceKm: number | null;
};

export type NoviceSessionCardProps = {
  session: Session;
  weekNumber: number;
  state: CheckinUiState;
  checkin?: NoviceCheckinSummary | null;
  readOnly?: boolean;
  onOpenCheckin: (session: Session) => void;
  onOpenReadonly?: (session: Session, checkin: NoviceCheckinSummary) => void;
  /** Dark cards to match `/program` hub. */
  skin?: "default" | "program";
};

const BORDER = {
  easy: "#5b8fd4",
  long: "#2d6a4f",
  tempo: "#d97706",
} as const;

function effortLine(type: "easy" | "long" | "tempo", targetRpe?: number | null): string {
  void targetRpe;
  if (type === "tempo") return "Aim for RPE 5 — comfortably hard.";
  if (type === "long") return "Keep it steady and conversational. RPE 4.";
  return "Keep it conversational. RPE 3.";
}

function CheckinStateRow({
  state,
  checkin,
  skin = "default",
}: {
  state: CheckinUiState;
  checkin?: NoviceCheckinSummary | null;
  skin?: "default" | "program";
}) {
  const program = skin === "program";
  const stravaC = program ? "var(--accent)" : "#0369a1";
  const doneC = program ? "#5DCAA5" : "#166534";
  const partialC = program ? "#f5b454" : "#b45309";
  const skipC = program ? "rgba(232,230,224,0.45)" : "#94a3b8";
  const muted = program ? "rgba(232,230,224,0.45)" : "#64748b";

  if (state === "not_started") return null;
  if (state === "strava_detected") {
    return (
      <p className="text-sm font-medium" style={{ color: stravaC }}>
        Strava activity detected — tap to review
      </p>
    );
  }
  if (state === "checked_in_complete") {
    return (
      <div className="flex items-center gap-2 text-sm" style={{ color: doneC }}>
        <Check className="w-4 h-4 shrink-0" strokeWidth={2.5} />
        <span>Done</span>
        {checkin?.actualDistanceKm != null ? (
          <span style={{ color: muted }}>({checkin.actualDistanceKm} km logged)</span>
        ) : null}
      </div>
    );
  }
  if (state === "checked_in_incomplete") {
    return (
      <div className="flex items-center gap-2 text-sm" style={{ color: partialC }}>
        <AlertCircle className="w-4 h-4 shrink-0" />
        <span>Partial session logged</span>
      </div>
    );
  }
  return (
    <div className="text-sm" style={{ color: skipC }}>
      Skipped
      {checkin?.skippedReason ? ` — ${checkin.skippedReason}` : null}
    </div>
  );
}

export function NoviceSessionCard({
  session,
  state,
  checkin,
  readOnly,
  onOpenCheckin,
  onOpenReadonly,
  skin = "default",
}: NoviceSessionCardProps) {
  const program = skin === "program";
  const type = session.type === "interval" ? "easy" : (session.type as "easy" | "long" | "tempo");
  const title = noviceSessionTitle(type);
  const border = BORDER[type === "tempo" ? "tempo" : type === "long" ? "long" : "easy"];
  const day = DAY_NAMES[session.day] ?? session.day;
  const rw = session.structure?.runWalkRatio;
  const variant = type === "long" ? "long" : "easy";

  const open = useCallback(() => {
    if (readOnly && checkin && onOpenReadonly) {
      onOpenReadonly(session, checkin);
      return;
    }
    if (state === "checked_in_complete" || state === "checked_in_incomplete" || state === "missed") {
      if (checkin && onOpenReadonly) onOpenReadonly(session, checkin);
      return;
    }
    onOpenCheckin(session);
  }, [readOnly, checkin, onOpenReadonly, onOpenCheckin, session, state]);

  return (
    <button
      type="button"
      onClick={open}
      className={
        program
          ? "w-full text-left rounded-2xl border p-4 sm:p-5 transition hover:opacity-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/35"
          : "w-full text-left rounded-2xl border border-black/[0.06] bg-[#faf8f5] p-4 sm:p-5 shadow-sm transition hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2d6a4f]/40"
      }
      style={
        program
          ? {
              background: "var(--card-bg)",
              borderColor: "rgba(255,255,255,0.08)",
              borderLeft: `4px solid ${border}`,
              boxShadow: "0 0 0 1px rgba(255,255,255,0.04)",
            }
          : { borderLeft: `4px solid ${border}` }
      }
    >
      <div className="space-y-3">
        <div
          className={`text-xs font-medium uppercase tracking-wide ${program ? "" : "text-[#64748b]"}`}
          style={program ? { color: "rgba(232,230,224,0.45)" } : undefined}
        >
          {day}
        </div>
        <div
          className={`text-lg font-semibold ${program ? "text-white" : "text-[#1e293b]"}`}
        >
          {title}
        </div>
        <div>
          <span
            className={
              program
                ? "inline-flex rounded-full px-3 py-1 text-sm font-medium"
                : "inline-flex rounded-full bg-[#ecfdf5] px-3 py-1 text-sm font-medium text-[#166534]"
            }
            style={
              program
                ? {
                    background: "rgba(45,212,191,0.12)",
                    color: "var(--accent)",
                    border: "1px solid rgba(45,212,191,0.25)",
                  }
                : undefined
            }
          >
            {formatProgramDistanceKm(session.targetDistanceKm)} km
          </span>
        </div>
        {rw && type !== "tempo" ? <NoviceRunWalkIndicator ratio={rw} variant={variant} /> : null}
        <p className={`text-sm ${program ? "" : "text-[#475569]"}`} style={program ? { color: "rgba(232,230,224,0.72)" } : undefined}>
          {effortLine(type, session.targetRpe)}
        </p>
        <CheckinStateRow state={state} checkin={checkin} skin={skin} />
      </div>
    </button>
  );
}

const LS_BRIDGE = "novice-bridge-explainer-collapsed";

export function NoviceBridgeRunCard({
  session,
  state,
  checkin,
  readOnly,
  onOpenCheckin,
  onOpenReadonly,
  skin = "default",
}: NoviceSessionCardProps) {
  const program = skin === "program";
  const [explainerOpen, setExplainerOpen] = useState(() => {
    if (typeof window === "undefined") return true;
    try {
      return localStorage.getItem(LS_BRIDGE) !== "1";
    } catch {
      return true;
    }
  });

  const toggleExplainer = useCallback((e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    setExplainerOpen((v) => {
      const next = !v;
      if (!next) {
        try {
          localStorage.setItem(LS_BRIDGE, "1");
        } catch {
          void 0;
        }
      }
      return next;
    });
  }, []);

  const title = noviceSessionTitle("tempo");
  const border = BORDER.tempo;
  const day = DAY_NAMES[session.day] ?? session.day;

  const open = useCallback(() => {
    if (readOnly && checkin && onOpenReadonly) {
      onOpenReadonly(session, checkin);
      return;
    }
    if (state === "checked_in_complete" || state === "checked_in_incomplete" || state === "missed") {
      if (checkin && onOpenReadonly) onOpenReadonly(session, checkin);
      return;
    }
    onOpenCheckin(session);
  }, [readOnly, checkin, onOpenReadonly, onOpenCheckin, session, state]);

  return (
    <button
      type="button"
      onClick={open}
      className={
        program
          ? "w-full text-left rounded-2xl border p-4 sm:p-5 transition hover:opacity-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#f59e0b]/35"
          : "w-full text-left rounded-2xl border border-black/[0.06] bg-[#faf8f5] p-4 sm:p-5 shadow-sm transition hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[#d97706]/40"
      }
      style={
        program
          ? {
              background: "var(--card-bg)",
              borderColor: "rgba(255,255,255,0.08)",
              borderLeft: `4px solid ${border}`,
              boxShadow: "0 0 0 1px rgba(255,255,255,0.04)",
            }
          : { borderLeft: `4px solid ${border}` }
      }
    >
      <div className="space-y-3">
        <div
          className={`text-xs font-medium uppercase tracking-wide ${program ? "" : "text-[#64748b]"}`}
          style={program ? { color: "rgba(232,230,224,0.45)" } : undefined}
        >
          {day}
        </div>
        <div className={`text-lg font-semibold ${program ? "text-white" : "text-[#1e293b]"}`}>{title}</div>
        <div>
          <span
            className={
              program
                ? "inline-flex rounded-full px-3 py-1 text-sm font-medium"
                : "inline-flex rounded-full bg-[#fffbeb] px-3 py-1 text-sm font-medium text-[#92400e]"
            }
            style={
              program
                ? {
                    background: "rgba(245,180,84,0.12)",
                    color: "#f5b454",
                    border: "1px solid rgba(245,180,84,0.28)",
                  }
                : undefined
            }
          >
            {formatProgramDistanceKm(session.targetDistanceKm)} km
          </span>
        </div>
        <div
          className={
            program
              ? "rounded-xl border p-3"
              : "rounded-xl bg-[#fffbeb] border border-[#fcd34d]/40 p-3"
          }
          style={
            program
              ? {
                  background: "rgba(245,180,84,0.06)",
                  borderColor: "rgba(245,180,84,0.22)",
                }
              : undefined
          }
        >
          <button
            type="button"
            onClick={toggleExplainer}
            className={`flex w-full items-center justify-between text-left text-sm font-semibold ${
              program ? "" : "text-[#92400e]"
            }`}
            style={program ? { color: "#f5b454" } : undefined}
          >
            What is a Bridge Run?
            <span
              className={`text-xs font-normal ${program ? "" : "text-[#78716c]"}`}
              style={program ? { color: "rgba(232,230,224,0.45)" } : undefined}
            >
              {explainerOpen ? "Hide" : "Show"}
            </span>
          </button>
          {explainerOpen ? (
            <p
              className={`mt-2 whitespace-pre-line text-sm leading-relaxed ${program ? "" : "text-[#57534e]"}`}
              style={program ? { color: "rgba(232,230,224,0.72)" } : undefined}
            >
              {BRIDGE_RUN_EXPLAINER}
            </p>
          ) : null}
        </div>
        <p className={`text-sm ${program ? "" : "text-[#475569]"}`} style={program ? { color: "rgba(232,230,224,0.72)" } : undefined}>
          {effortLine("tempo", session.targetRpe)}
        </p>
        <CheckinStateRow state={state} checkin={checkin} skin={skin} />
      </div>
    </button>
  );
}
