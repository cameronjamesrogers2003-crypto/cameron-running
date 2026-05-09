"use client";

import { useState } from "react";

interface HistoryItem {
  id: string;
  dateLabel: string;
  type: string;
  weekNumber: number;
  reason: string;
  dotColor: string;
}

export default function PlanHistoryPanel({ items }: { items: HistoryItem[] }) {
  const [open, setOpen] = useState(false);

  return (
    <div
      className="rounded-2xl border bg-[var(--card-bg)] border-white/[0.08] backdrop-blur-sm overflow-hidden"
    >
      <button
        type="button"
        className="w-full flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-white/[0.03] transition-colors"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <p className="text-xs font-semibold tracking-widest uppercase" style={{ color: "var(--text-label)" }}>
          Plan History
        </p>
        <span
          className="text-xs transition-transform duration-200"
          style={{
            color: "var(--text-muted)",
            display: "inline-block",
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
          }}
        >
          ▾
        </span>
      </button>

      {open && (
        <div className="px-4 pb-4 pt-1 space-y-1.5 border-t border-white/[0.06]">
          {items.map((item) => (
            <div key={item.id} className="flex items-start gap-3 py-2.5 border-b border-white/[0.06] last:border-0">
              <p className="text-xs font-mono shrink-0 w-20" style={{ color: "var(--text-dim)" }}>
                {item.dateLabel}
              </p>
              <span
                className="w-2 h-2 rounded-full mt-1.5 shrink-0"
                style={{ background: item.dotColor }}
              />
              <div className="min-w-0">
                <p className="text-xs text-white">
                  {item.type} · Week {item.weekNumber}
                </p>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>{item.reason}</p>
              </div>
            </div>
          ))}
          {items.length === 0 && (
            <p className="text-xs py-2" style={{ color: "var(--text-muted)" }}>No adaptations recorded yet.</p>
          )}
        </div>
      )}
    </div>
  );
}
