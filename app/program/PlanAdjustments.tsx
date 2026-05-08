"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";

interface Props {
  adjustmentSummary: string[];
  totalWeeksAdded: number;
  newPlanEndDate: string;
}

export default function PlanAdjustments({ adjustmentSummary, totalWeeksAdded, newPlanEndDate }: Props) {
  const [open, setOpen] = useState(true);

  if (!adjustmentSummary.length) return null;

  return (
    <Card
      className="rounded-xl mb-2"
      style={{ border: "1px solid rgba(167,139,250,0.2)" }}
    >
      <button
        type="button"
        className="w-full min-h-11 flex items-center justify-between px-4 py-3 text-left"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex items-center gap-2.5">
          <span
            className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider"
            style={{ background: "rgba(167,139,250,0.15)", color: "#a78bfa" }}
          >
            Plan adjusted
          </span>
          <span className="text-xs" style={{ color: "var(--text-primary)" }}>
            +{totalWeeksAdded} {totalWeeksAdded === 1 ? "week" : "weeks"} added · ends {newPlanEndDate}
          </span>
        </div>
        <svg
          width="12" height="12" viewBox="0 0 12 12" fill="none"
          style={{
            transform: open ? "rotate(0deg)" : "rotate(-90deg)",
            transition: "transform 120ms ease",
            color: "var(--text-muted)",
            flexShrink: 0,
          }}
        >
          <path d="M2 4L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <div
        style={{
          overflow: "hidden",
          maxHeight: open ? "400px" : "0",
          transition: "max-height 120ms ease",
        }}
      >
        <div className="px-4 pb-3 space-y-1.5">
          {adjustmentSummary.map((line, i) => (
            <div key={i} className="flex items-start gap-2">
              <span style={{ color: "#a78bfa", marginTop: "1px", flexShrink: 0 }}>·</span>
              <span className="text-xs" style={{ color: "var(--text-secondary)" }}>{line}</span>
            </div>
          ))}
          <p
            className="text-[11px] pt-1"
            style={{ color: "var(--text-muted)", borderTop: "1px solid var(--border-subtle)", marginTop: "8px", paddingTop: "8px" }}
          >
            Recovery weeks use reduced volume at easy effort to safely return to training.
          </p>
        </div>
      </div>
    </Card>
  );
}
