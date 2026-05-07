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
  if (item.type === "volume_reduced") {
    return `Your recent runs are averaging below target. We've reduced next week's distances by 10% to help you recover. Keep going!`;
  }
  if (item.type === "volume_increased") {
    return `Your recent runs are consistently strong. We've increased next week's distances by 5% to keep your progression moving.`;
  }
  return `You've had several tough weeks, so we converted next week's hard session to easy for a soft cutback.`;
}

export default function PlanAdaptationCards({ initialItems }: { initialItems: AdaptationItem[] }) {
  const [items, setItems] = useState(initialItems);

  async function dismiss(id: string) {
    const res = await fetch(`/api/plan-adaptations/${id}/dismiss`, { method: "POST" });
    if (!res.ok) return;
    setItems((prev) => prev.filter((item) => item.id !== id));
  }

  if (items.length === 0) return null;

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div
          key={item.id}
          className="rounded-lg p-4"
          style={{ background: "#121a19", border: "1px solid rgba(45,212,191,0.35)" }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <p className="text-sm font-semibold" style={{ color: "#99f6e4" }}>
                📊 Plan Updated — Week {item.weekNumber}
              </p>
              <p className="text-sm" style={{ color: "#ccfbf1" }}>
                {messageFor(item)}
              </p>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                {item.reason}
              </p>
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
    </div>
  );
}
