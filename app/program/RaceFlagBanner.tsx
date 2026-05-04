"use client";

import { useState } from "react";

interface Props {
  planEndDate: string;
  raceDate: string;
  weeksOver: number;
}

export default function RaceFlagBanner({ planEndDate, raceDate, weeksOver }: Props) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div
      className="rounded-xl px-4 py-3 flex items-start justify-between gap-4 mb-2"
      style={{
        background: "rgba(251,191,36,0.06)",
        border: "1px solid rgba(251,191,36,0.25)",
      }}
    >
      <div className="flex items-start gap-3">
        <span className="text-base leading-none mt-0.5">⚠️</span>
        <div>
          <p className="text-sm font-semibold" style={{ color: "#fbbf24" }}>
            Plan extends past race date
          </p>
          <p className="text-xs mt-0.5" style={{ color: "rgba(251,191,36,0.7)" }}>
            With recovery weeks, the plan now ends {planEndDate} —{" "}
            {weeksOver === 1 ? "1 week" : `${weeksOver} weeks`} after your race on {raceDate}.
            Consider shortening recovery or adjusting your race date in Settings.
          </p>
        </div>
      </div>
      <button
        onClick={() => setDismissed(true)}
        className="shrink-0 mt-0.5 min-h-11 min-w-11 inline-flex items-center justify-center rounded-lg"
        style={{ color: "rgba(251,191,36,0.4)" }}
        aria-label="Dismiss"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M2 2L12 12M12 2L2 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}
