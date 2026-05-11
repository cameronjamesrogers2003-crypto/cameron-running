"use client";

import { format } from "date-fns";
import { useSync } from "@/context/SyncContext";

export default function SyncButton() {
  const { handleSync, loading, result, warning, stravaConnected, lastSynced } = useSync();

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <button
        onClick={handleSync}
        disabled={loading}
        className="min-h-11 px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 w-full sm:w-auto"
        style={{
          background: stravaConnected ? "var(--accent)" : "var(--surface-2)",
          color: stravaConnected ? "#000" : "var(--text-muted)",
          border: stravaConnected ? "none" : "1px solid var(--border)",
        }}
      >
        {loading ? "Syncing…" : stravaConnected ? "Sync with Strava" : "Connect Strava"}
      </button>
      <div className="text-xs" style={{ color: "var(--text-muted)" }}>
        {result ? (
          <span className={warning ? "text-yellow-400" : "text-green-400"}>
            {warning ?? result}
          </span>
        ) : lastSynced ? (
          <span>Last synced: {format(new Date(lastSynced), "d MMM HH:mm")}</span>
        ) : (
          <span>{stravaConnected ? "Never synced" : "Not connected"}</span>
        )}
      </div>
    </div>
  );
}
