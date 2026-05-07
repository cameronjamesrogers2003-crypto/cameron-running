"use client";

import { useEffect, useState } from "react";

export default function PlanUpdatedBanner({ fromWeek }: { fromWeek: number }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(false), 5000);
    return () => window.clearTimeout(timer);
  }, []);

  if (!visible) return null;

  return (
    <div
      className="rounded-lg px-4 py-3 flex items-start justify-between gap-3"
      style={{ background: "rgba(45,212,191,0.12)", border: "1px solid rgba(45,212,191,0.32)" }}
    >
      <p className="text-sm" style={{ color: "#99f6e4" }}>
        Your training plan has been updated from Week {fromWeek} onwards. Completed weeks are unchanged.
      </p>
      <button
        type="button"
        onClick={() => setVisible(false)}
        className="text-sm leading-none"
        style={{ color: "#5eead4" }}
        aria-label="Dismiss update banner"
      >
        ×
      </button>
    </div>
  );
}
