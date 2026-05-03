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
        className="w-full flex items-center justify-between px-4 py-2.5"
        onClick={() => setOpen(o => !o)}
      >
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
          Phase Overview
        </span>
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
          className="px-4 pb-3 text-[13px] leading-relaxed"
          style={{ color: "rgba(232,230,224,0.55)" }}
        >
          {description}
        </p>
      </div>
    </div>
  );
}
