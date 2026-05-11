"use client";

import { startTransition, useEffect, useState, useRef } from "react";
import { format } from "date-fns";
import { useRouter } from "next/navigation";
import { useConfirmRunQueue } from "@/hooks/useConfirmRunQueue";
import ConfirmRunModal from "@/components/ConfirmRunModal";
import { useSettings } from "@/context/SettingsContext";

interface SyncButtonProps {
  lastSynced?: string | null;
  stravaConnected: boolean;
}

export default function SyncButton({ lastSynced, stravaConnected }: SyncButtonProps) {
  const router = useRouter();
  const { setIsRefreshing } = useSettings();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [newIds, setNewIds] = useState<string[]>([]);
  const [unconfirmedIds, setUnconfirmedIds] = useState<string[]>([]);
  const [unconfirmedLoaded, setUnconfirmedLoaded] = useState(false);
  const mountQueueInitialised = useRef(false);

  const {
    currentRun,
    currentPlannedSession,
    handleConfirm,
    handleDismiss,
    isQueueEmpty,
  } = useConfirmRunQueue(newIds);

  // Fetch unconfirmed runs on mount
  useEffect(() => {
    if (mountQueueInitialised.current) return;
    mountQueueInitialised.current = true;

    fetch("/api/runs/unconfirmed")
      .then((res) => res.json())
      .then((data) => {
        const ids = data.unconfirmedIds || [];
        setUnconfirmedIds(ids);
        setUnconfirmedLoaded(true);
        if (ids.length > 0) {
          setNewIds(ids);
        }
      })
      .catch((err) => {
        console.error("Failed to fetch unconfirmed runs:", err);
        setUnconfirmedLoaded(true);
      });
  }, []);

  // Refresh the page data when the queue is finished
  useEffect(() => {
    if (newIds.length > 0 && isQueueEmpty) {
      setIsRefreshing(true);
      router.refresh();
      // Keep track of what we've already tried to confirm in this session
      setUnconfirmedIds([]); 
      setNewIds([]);
    }
  }, [isQueueEmpty, newIds, router, setIsRefreshing]);

  // Reset refreshing state when data arrives
  useEffect(() => {
    setIsRefreshing(false);
  }, [lastSynced, setIsRefreshing]);

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
      router.push("/api/strava/login");
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
        
        const syncIds = data.newActivityIds || [];
        
        // Ensure we have finished the mount fetch before merging
        const triggerSync = () => {
          const allIds = [...new Set([...syncIds, ...unconfirmedIds])];
          if (allIds.length > 0) {
            setNewIds(allIds);
          } else {
            setIsRefreshing(true);
            router.refresh();
          }
        };

        if (unconfirmedLoaded) {
          triggerSync();
        } else {
          // Poll briefly if still loading unconfirmed on mount
          const interval = setInterval(() => {
            if (unconfirmedLoaded) {
              clearInterval(interval);
              triggerSync();
            }
          }, 100);
          setTimeout(() => { clearInterval(interval); triggerSync(); }, 2000); // safety timeout
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
