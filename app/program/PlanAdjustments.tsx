"use client";

import { useState } from "react";

interface Props {
  adjustmentSummary: string[];
  totalWeeksAdded: number;
  newPlanEndDate: string;
}

export default function PlanAdjustments({ adjustmentSummary, totalWeeksAdded, newPlanEndDate }: Props) {
  const [open, setOpen] = useState(true);

  if (!adjustmentSummary.length) return null;

  return (
    <div
      className="rounded-xl"
      style={{
        background: "#181818",
        border: "1px solid rgba(167,139,250,0.2)",
        marginBottom: "8px",
      }}
    >
      <button
        className="w-full flex items-center justify-between px-4 py-3"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex items-center gap-2.5">
          <span
            className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider"
            style={{ background: "rgba(167,139,250,0.15)", color: "#a78bfa" }}
          >
            Plan adjusted
          </span>
          <span className="text-xs text-white">
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
              <span className="text-xs" style={{ color: "rgba(232,230,224,0.6)" }}>{line}</span>
            </div>
          ))}
          <p
            className="text-[11px] pt-1"
            style={{ color: "rgba(232,230,224,0.3)", borderTop: "1px solid rgba(255,255,255,0.05)", marginTop: "8px", paddingTop: "8px" }}
          >
            Recovery weeks use reduced volume at easy effort to safely return to training.
          </p>
        </div>
      </div>
    </div>
  );
}
