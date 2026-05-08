"use client";

import { useState } from "react";

type AdaptationItem = {
  id: string;
  weekNumber: number;
  type: string;
  reason: string;
  changes: string;
};

function messageFor(item: AdaptationItem): string {
  if (item.type === "volume_reduced") return "We've eased your plan";
  if (item.type === "volume_increased") return "We've pushed your plan";
  if (item.type === "missed_sessions_warning") return "Sessions missed";
  if (item.type === "cutback_inserted") return "Recovery week added";
  if (item.type === "extended_recovery") return "Extended recovery";
  if (item.type === "vdot_improved") return "Fitness improvement!";
  return "Plan updated";
}

function iconFor(item: AdaptationItem): string {
  if (item.type === "volume_reduced") return "↓";
  if (item.type === "volume_increased") return "↑";
  if (item.type === "missed_sessions_warning") return "!";
  if (item.type === "cutback_inserted" || item.type === "extended_recovery") return "⟳";
  if (item.type === "vdot_improved") return "★";
  return "•";
}

function borderClassFor(item: AdaptationItem): string {
  if (item.type === "volume_reduced") return "border-l-4 border-blue-500/60";
  if (item.type === "volume_increased") return "border-l-4 border-teal-500/60";
  if (item.type === "missed_sessions_warning") return "border-l-4 border-amber-500/60";
  if (item.type === "cutback_inserted") return "border-l-4 border-amber-500/60";
  if (item.type === "extended_recovery") return "border-l-4 border-blue-500/60";
  if (item.type === "vdot_improved") return "border-l-4 border-teal-500/60";
  return "border-l-4 border-white/20";
}

function iconColorFor(item: AdaptationItem): string {
  if (item.type === "volume_increased" || item.type === "vdot_improved") return "var(--accent)";
  if (item.type === "missed_sessions_warning" || item.type === "cutback_inserted") return "#f5b454";
  return "#7dd3fc";
}

export default function PlanAdaptationCards({ initialItems }: { initialItems: AdaptationItem[] }) {
  const [items, setItems] = useState(initialItems);

  async function dismiss(id: string) {
    const res = await fetch(`/api/plan-adaptations/${id}/dismiss`, { method: "POST" });
    if (!res.ok) return;
    setItems((prev) => prev.filter((item) => item.id !== id));
  }

  if (items.length === 0) return null;

  const visible = items.slice(0, 3);
  const remaining = items.length - visible.length;

  return (
    <div className="space-y-3">
      {visible.map((item) => (
        <div
          key={item.id}
          className={`rounded-lg p-4 ${borderClassFor(item)}`}
          style={{ background: "var(--surface-base)", borderTop: "1px solid var(--border-subtle)", borderRight: "1px solid var(--border-subtle)", borderBottom: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-card)" }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                <span style={{ color: iconColorFor(item) }}>{iconFor(item)}</span> {messageFor(item)}
              </p>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                {item.reason}
              </p>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>Week {item.weekNumber}</p>
            </div>
            <button
              type="button"
              onClick={() => dismiss(item.id)}
              className="text-xs opacity-50 hover:opacity-100 transition-opacity ml-auto"
              style={{ color: "var(--text-muted)" }}
            >
              Dismiss
            </button>
          </div>
        </div>
      ))}
      {remaining > 0 && (
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          Show {remaining} more
        </p>
      )}
    </div>
  );
}
