"use client";

import { useState } from "react";

export default function PhaseOverview({ description }: { description: string }) {
  const [open, setOpen] = useState(true);

  return (
    <div
      className="rounded-lg mb-2"
      style={{ background: "#141414", border: "1px solid rgba(255,255,255,0.06)" }}
    >
      <button
        type="button"
        className="flex items-center justify-between px-4 py-3 rounded-xl cursor-pointer bg-[var(--card-bg)] border border-white/[0.08] hover:bg-white/[0.06] transition-colors w-full min-h-11 text-left"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-white">Phase Overview</span>
          <span className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>Details</span>
        </div>
        <svg
          width="12" height="12" viewBox="0 0 12 12" fill="none"
          style={{
            transform: open ? "rotate(0deg)" : "rotate(-90deg)",
            transition: "transform 120ms ease",
            color: "var(--text-muted)",
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
        <p
          className="text-sm leading-relaxed mt-3 px-1 pb-3"
          style={{ color: "var(--text-muted)" }}
        >
          {description}
        </p>
      </div>
    </div>
  );
}
