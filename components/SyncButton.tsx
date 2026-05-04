"use client";

import { useState } from "react";
import { format } from "date-fns";

interface SyncButtonProps {
  lastSynced?: string | null;
  stravaConnected: boolean;
}

export default function SyncButton({ lastSynced, stravaConnected }: SyncButtonProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function handleSync() {
    if (!stravaConnected) {
      window.location.href = "/api/strava/login";
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/strava/sync", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setResult(`Synced ${data.synced} new activities`);
        setTimeout(() => window.location.reload(), 800);
      } else {
        setResult(data.error ?? "Sync failed");
      }
    } catch {
      setResult("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <button
        onClick={handleSync}
        disabled={loading}
        className="min-h-11 px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 w-full sm:w-auto"
        style={{
          background: stravaConnected ? "var(--accent)" : "var(--surface-2)",
          color: stravaConnected ? "#fff" : "var(--text-muted)",
          border: stravaConnected ? "none" : "1px solid var(--border)",
        }}
      >
        {loading ? "Syncing…" : stravaConnected ? "Sync with Strava" : "Connect Strava"}
      </button>
      <div className="text-xs" style={{ color: "var(--text-muted)" }}>
        {result ? (
          <span className="text-green-400">{result}</span>
        ) : lastSynced ? (
          <span>Last synced: {format(new Date(lastSynced), "d MMM HH:mm")}</span>
        ) : (
          <span>{stravaConnected ? "Never synced" : "Not connected"}</span>
        )}
      </div>
    </div>
  );
}
