"use client";

import { useCallback, useState, type MouseEvent } from "react";
import { NoviceRunWalkIndicator } from "@/components/novice/NoviceRunWalkIndicator";
import { noviceSessionTitle, BRIDGE_RUN_EXPLAINER } from "@/lib/noviceUiCopy";
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
}: {
  state: CheckinUiState;
  checkin?: NoviceCheckinSummary | null;
}) {
  if (state === "not_started") return null;
  if (state === "strava_detected") {
    return <p className="text-sm font-medium text-[#0369a1]">Strava activity detected — tap to review</p>;
  }
  if (state === "checked_in_complete") {
    return (
      <div className="flex items-center gap-2 text-sm text-[#166534]">
        <Check className="w-4 h-4 shrink-0" strokeWidth={2.5} />
        <span>Done</span>
        {checkin?.actualDistanceKm != null ? (
          <span className="text-[#64748b]">({checkin.actualDistanceKm} km logged)</span>
        ) : null}
      </div>
    );
  }
  if (state === "checked_in_incomplete") {
    return (
      <div className="flex items-center gap-2 text-sm text-[#b45309]">
        <AlertCircle className="w-4 h-4 shrink-0" />
        <span>Partial session logged</span>
      </div>
    );
  }
  return (
    <div className="text-sm text-[#94a3b8]">
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
}: NoviceSessionCardProps) {
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
      className="w-full text-left rounded-2xl border border-black/[0.06] bg-[#faf8f5] p-4 sm:p-5 shadow-sm transition hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2d6a4f]/40"
      style={{ borderLeft: `4px solid ${border}` }}
    >
      <div className="space-y-3">
        <div className="text-xs font-medium uppercase tracking-wide text-[#64748b]">{day}</div>
        <div className="text-lg font-semibold text-[#1e293b]">{title}</div>
        <div>
          <span className="inline-flex rounded-full bg-[#ecfdf5] px-3 py-1 text-sm font-medium text-[#166534]">
            {session.targetDistanceKm} km
          </span>
        </div>
        {rw && type !== "tempo" ? <NoviceRunWalkIndicator ratio={rw} variant={variant} /> : null}
        <p className="text-sm text-[#475569]">{effortLine(type, session.targetRpe)}</p>
        <CheckinStateRow state={state} checkin={checkin} />
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
}: NoviceSessionCardProps) {
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
      className="w-full text-left rounded-2xl border border-black/[0.06] bg-[#faf8f5] p-4 sm:p-5 shadow-sm transition hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[#d97706]/40"
      style={{ borderLeft: `4px solid ${border}` }}
    >
      <div className="space-y-3">
        <div className="text-xs font-medium uppercase tracking-wide text-[#64748b]">{day}</div>
        <div className="text-lg font-semibold text-[#1e293b]">{title}</div>
        <div>
          <span className="inline-flex rounded-full bg-[#fffbeb] px-3 py-1 text-sm font-medium text-[#92400e]">
            {session.targetDistanceKm} km
          </span>
        </div>
        <div className="rounded-xl bg-[#fffbeb] border border-[#fcd34d]/40 p-3">
          <button type="button" onClick={toggleExplainer} className="flex w-full items-center justify-between text-left text-sm font-semibold text-[#92400e]">
            What is a Bridge Run?
            <span className="text-xs font-normal text-[#78716c]">{explainerOpen ? "Hide" : "Show"}</span>
          </button>
          {explainerOpen ? (
            <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-[#57534e]">{BRIDGE_RUN_EXPLAINER}</p>
          ) : null}
        </div>
        <p className="text-sm text-[#475569]">{effortLine("tempo", session.targetRpe)}</p>
        <CheckinStateRow state={state} checkin={checkin} />
      </div>
    </button>
  );
}
