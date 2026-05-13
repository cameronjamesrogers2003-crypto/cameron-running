"use client";

import { useCallback, useState } from "react";
import { ArrowDown, ArrowRight, RefreshCw } from "lucide-react";

const STORAGE_PREFIX = "novice-adaptive-dismissed:";

export type AdaptiveDecision = "REPEAT_WEEK" | "REDUCE_LOAD" | "ACCELERATE";

export type NoviceAdaptiveDecisionCardProps = {
  evaluationId: string;
  decision: AdaptiveDecision;
  reason: string;
};

export function NoviceAdaptiveDecisionCard({ evaluationId, decision, reason }: NoviceAdaptiveDecisionCardProps) {
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
      className="rounded-2xl border border-black/[0.06] bg-[#faf8f5] p-4 sm:p-5 shadow-sm mb-4"
      style={{ borderLeft: `4px solid ${border}` }}
    >
      <div className="flex gap-3">
        <div className="mt-0.5 shrink-0 text-[#334155]" aria-hidden>
          <Icon className="w-5 h-5" strokeWidth={2} />
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <h2 className="text-base font-semibold text-[#1e293b] tracking-tight">{headline}</h2>
          <p className="text-sm text-[#475569] leading-relaxed">{reason}</p>
          <p className="text-sm text-[#64748b] leading-relaxed">{whatChanged}</p>
          <button
            type="button"
            onClick={dismissPermanent}
            className="text-sm font-medium text-[#475569] underline-offset-2 hover:underline mt-1"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
