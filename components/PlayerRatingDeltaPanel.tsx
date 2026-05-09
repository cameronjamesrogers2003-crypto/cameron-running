"use client";

import { startTransition, useEffect, useState } from "react";
import type { PlayerRatingSummaryRow } from "@/lib/playerRating";

interface Props {
  updatedAt: string;
  rows: PlayerRatingSummaryRow[];
}

function deltaLabel(delta: number): string {
  if (delta === 0) return "-";
  return `${delta > 0 ? "+" : ""}${delta}`;
}

function deltaArrow(delta: number): string {
  if (delta > 0) return "↑";
  if (delta < 0) return "↓";
  return "";
}

export default function PlayerRatingDeltaPanel({ updatedAt, rows }: Props) {
  const storageKey = `player-rating-summary-dismissed:${updatedAt}`;
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    startTransition(() => {
      setDismissed(window.localStorage.getItem(storageKey) === "1");
    });
  }, [storageKey]);

  if (dismissed || rows.length === 0) return null;

  return (
    <div
      className="rounded-2xl p-4 sm:p-5"
      style={{
        background: "linear-gradient(135deg, rgba(34,197,94,0.14), rgba(14,165,233,0.08))",
        border: "1px solid rgba(34,197,94,0.28)",
        boxShadow: "0 18px 48px rgba(0,0,0,0.24)",
      }}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] font-semibold text-green-300">
            Player rating updated
          </p>
          <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
            Changes from the latest synced run
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            window.localStorage.setItem(storageKey, "1");
            setDismissed(true);
          }}
          className="min-h-11 min-w-11 inline-flex items-center justify-center rounded-lg"
          style={{ color: "rgba(255,255,255,0.5)" }}
          aria-label="Dismiss player rating summary"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M2 2L12 12M12 2L2 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <div className="mt-4 space-y-2">
        {rows.map((row) => {
          const changed = row.delta !== 0;
          return (
            <div
              key={row.key}
              className="grid grid-cols-[42px_1fr] gap-x-3 gap-y-1 rounded-xl px-3 py-2 sm:grid-cols-[42px_112px_42px_1fr] sm:items-center"
              style={{ background: "rgba(0,0,0,0.22)" }}
            >
              <span className="text-xs font-bold tracking-wider text-white">{row.label}</span>
              <span className="text-sm font-semibold tabular-nums text-white">
                {row.before} <span style={{ color: "var(--text-muted)" }}>→</span> {row.after}
              </span>
              <span
                className="text-sm font-bold tabular-nums"
                style={{ color: changed ? (row.delta > 0 ? "#4ade80" : "#f87171") : "var(--text-muted)" }}
              >
                {changed ? `${deltaArrow(row.delta)}${Math.abs(row.delta)}` : deltaLabel(row.delta)}
              </span>
              <span className="col-span-2 text-xs sm:col-span-1" style={{ color: "var(--text-muted)" }}>
                {changed ? row.reason : "-"}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
