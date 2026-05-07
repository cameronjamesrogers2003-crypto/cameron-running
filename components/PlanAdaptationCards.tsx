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
  if (item.type === "volume_reduced") return "📉";
  if (item.type === "volume_increased") return "📈";
  if (item.type === "missed_sessions_warning") return "⚠️";
  if (item.type === "cutback_inserted" || item.type === "extended_recovery") return "🔄";
  if (item.type === "vdot_improved") return "🎯";
  return "📌";
}

function borderFor(item: AdaptationItem): string {
  if (item.type === "volume_increased" || item.type === "vdot_improved") return "1px solid rgba(45,212,191,0.45)";
  if (item.type === "missed_sessions_warning") return "1px solid rgba(251,191,36,0.45)";
  return "1px solid rgba(96,165,250,0.4)";
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
          className="rounded-lg p-4"
          style={{ background: "#121a19", border: borderFor(item) }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-white">
                {iconFor(item)} {messageFor(item)}
              </p>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                {item.reason}
              </p>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>Week {item.weekNumber}</p>
            </div>
            <button
              type="button"
              onClick={() => dismiss(item.id)}
              className="text-xs px-2 py-1 rounded border"
              style={{ borderColor: "rgba(45,212,191,0.4)", color: "#99f6e4" }}
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
