"use client";

import { useCallback, useState } from "react";
import { ArrowDown, ArrowRight, RefreshCw } from "lucide-react";

const STORAGE_PREFIX = "novice-adaptive-dismissed:";

export type AdaptiveDecision = "REPEAT_WEEK" | "REDUCE_LOAD" | "ACCELERATE";

export type NoviceAdaptiveDecisionCardProps = {
  evaluationId: string;
  decision: AdaptiveDecision;
  reason: string;
  skin?: "default" | "program";
};

export function NoviceAdaptiveDecisionCard({
  evaluationId,
  decision,
  reason,
  skin = "default",
}: NoviceAdaptiveDecisionCardProps) {
  const storageKey = `${STORAGE_PREFIX}${evaluationId}`;
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return localStorage.getItem(storageKey) === "1";
    } catch {
      return false;
    }
  });

  const dismissPermanent = useCallback(() => {
    try {
      localStorage.setItem(storageKey, "1");
    } catch {
      void 0;
    }
    setCollapsed(true);
  }, [storageKey]);

  if (collapsed) return null;

  const border =
    decision === "REPEAT_WEEK"
      ? "#5b8fd4"
      : decision === "REDUCE_LOAD"
        ? "#d97706"
        : "#2d6a4f";

  const Icon = decision === "REPEAT_WEEK" ? RefreshCw : decision === "REDUCE_LOAD" ? ArrowDown : ArrowRight;

  const program = skin === "program";

  const headline =
    decision === "REPEAT_WEEK"
      ? "Repeating this week"
      : decision === "REDUCE_LOAD"
        ? "Lighter week ahead"
        : "Moving you forward";

  const whatChanged =
    decision === "REPEAT_WEEK"
      ? "This week's sessions are the same as last week. Your plan end date has moved by one week."
      : decision === "REDUCE_LOAD"
        ? "Next week's distances have been reduced by 20%. Session types are unchanged."
        : "You're ahead of schedule. One week has been skipped — your plan is now one week shorter.";

  return (
    <div
      className={
        program
          ? "rounded-2xl border p-4 sm:p-5 mb-4"
          : "rounded-2xl border border-black/[0.06] bg-[#faf8f5] p-4 sm:p-5 shadow-sm mb-4"
      }
      style={{
        borderLeft: `4px solid ${border}`,
        ...(program
          ? {
              background: "var(--card-bg)",
              borderColor: "rgba(255,255,255,0.08)",
              boxShadow: "0 0 0 1px rgba(255,255,255,0.04)",
            }
          : {}),
      }}
    >
      <div className="flex gap-3">
        <div className="mt-0.5 shrink-0" style={{ color: program ? "rgba(232,230,224,0.7)" : "#334155" }} aria-hidden>
          <Icon className="w-5 h-5" strokeWidth={2} />
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <h2 className={`text-base font-semibold tracking-tight ${program ? "text-white" : "text-[#1e293b]"}`}>
            {headline}
          </h2>
          <p
            className={`text-sm leading-relaxed ${program ? "" : "text-[#475569]"}`}
            style={program ? { color: "rgba(232,230,224,0.78)" } : undefined}
          >
            {reason}
          </p>
          <p
            className={`text-sm leading-relaxed ${program ? "" : "text-[#64748b]"}`}
            style={program ? { color: "rgba(232,230,224,0.5)" } : undefined}
          >
            {whatChanged}
          </p>
          <button
            type="button"
            onClick={dismissPermanent}
            className={`text-sm font-medium underline-offset-2 hover:underline mt-1 ${program ? "" : "text-[#475569]"}`}
            style={program ? { color: "var(--accent)" } : undefined}
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
