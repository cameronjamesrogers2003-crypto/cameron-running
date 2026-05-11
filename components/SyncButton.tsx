"use client";

import { startTransition, useEffect, useState } from "react";
import { format } from "date-fns";
import { useRouter } from "next/navigation";
import { useConfirmRunQueue } from "@/hooks/useConfirmRunQueue";
import ConfirmRunModal from "@/components/ConfirmRunModal";

interface SyncButtonProps {
  lastSynced?: string | null;
  stravaConnected: boolean;
}

export default function SyncButton({ lastSynced, stravaConnected }: SyncButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [newIds, setNewIds] = useState<string[]>([]);

  const {
    currentRun,
    currentPlannedSession,
    handleConfirm,
    handleDismiss,
    isQueueEmpty,
  } = useConfirmRunQueue(newIds);

  // Refresh the page data when the queue is finished
  useEffect(() => {
    if (newIds.length > 0 && isQueueEmpty) {
      router.refresh();
      setNewIds([]); // Clear the trigger
    }
  }, [isQueueEmpty, newIds, router]);

  useEffect(() => {
    const storedWarning = window.sessionStorage.getItem("syncPlayerRatingWarning");
    if (!storedWarning) return;
    window.sessionStorage.removeItem("syncPlayerRatingWarning");
    startTransition(() => {
      setResult("Sync completed");
      setWarning(storedWarning);
    });
  }, []);

  async function handleSync() {
    if (!stravaConnected) {
      window.location.href = "/api/strava/login";
      return;
    }
    setLoading(true);
    setResult(null);
    setWarning(null);
    try {
      const token = process.env.NEXT_PUBLIC_PLANS_API_TOKEN;
      const res = await fetch("/api/strava/sync", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      if (res.ok) {
        setResult(`Synced ${data.synced} new activities`);
        if (data.playerRatingError) {
          const playerRatingWarning = "Player rating failed to update — try syncing again";
          setWarning(playerRatingWarning);
          window.sessionStorage.setItem("syncPlayerRatingWarning", playerRatingWarning);
        } else {
          window.sessionStorage.removeItem("syncPlayerRatingWarning");
        }
        
        if (data.newActivityIds && data.newActivityIds.length > 0) {
          setNewIds(data.newActivityIds);
        } else {
          setTimeout(() => router.refresh(), 800);
        }
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
    <>
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={handleSync}
          disabled={loading}
          className="min-h-11 px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 w-full sm:w-auto"
          style={{
            background: stravaConnected ? "var(--accent)" : "var(--surface-2)",
            color: stravaConnected ? "#000" : "var(--text-muted)", // Fixed text color for accessibility on accent
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

      {currentRun && (
        <ConfirmRunModal
          activity={currentRun}
          plannedSession={currentPlannedSession}
          onConfirm={handleConfirm}
          onDismiss={handleDismiss}
        />
      )}
    </>
  );
}
