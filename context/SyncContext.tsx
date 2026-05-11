"use client";

import { createContext, useContext, useEffect, useState, useRef, startTransition } from "react";
import { useRouter } from "next/navigation";
import { useConfirmRunQueue } from "@/hooks/useConfirmRunQueue";
import ConfirmRunModal from "@/components/ConfirmRunModal";
import { useSettings } from "@/context/SettingsContext";

interface SyncContextValue {
  handleSync: () => Promise<void>;
  loading: boolean;
  result: string | null;
  warning: string | null;
  stravaConnected: boolean;
  lastSynced: string | null;
}

const SyncContext = createContext<SyncContextValue>({
  handleSync: async () => {},
  loading: false,
  result: null,
  warning: null,
  stravaConnected: false,
  lastSynced: null,
});

export function SyncProvider({
  children,
  initialStravaConnected,
  initialLastSynced,
}: {
  children: React.ReactNode;
  initialStravaConnected: boolean;
  initialLastSynced: string | null;
}) {
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

  useEffect(() => {
    if (mountQueueInitialised.current) return;
    mountQueueInitialised.current = true;

    fetch("/api/runs/unconfirmed")
      .then((res) => res.json())
      .then((data) => {
        const ids = data.unconfirmedIds || [];
        setUnconfirmedIds(ids);
        setUnconfirmedLoaded(true);
        if (ids.length > 0) setNewIds(ids);
      })
      .catch((err) => {
        console.error("Failed to fetch unconfirmed runs:", err);
        setUnconfirmedLoaded(true);
      });
  }, []);

  useEffect(() => {
    if (newIds.length > 0 && isQueueEmpty) {
      setIsRefreshing(true);
      router.refresh();
      setUnconfirmedIds([]); 
      setNewIds([]);
    }
  }, [isQueueEmpty, newIds, router, setIsRefreshing]);

  useEffect(() => {
    setIsRefreshing(false);
  }, [initialLastSynced, setIsRefreshing]);

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
    if (!initialStravaConnected) {
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
          const interval = setInterval(() => {
            if (unconfirmedLoaded) {
              clearInterval(interval);
              triggerSync();
            }
          }, 100);
          setTimeout(() => { clearInterval(interval); triggerSync(); }, 2000);
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
    <SyncContext.Provider value={{ handleSync, loading, result, warning, stravaConnected: initialStravaConnected, lastSynced: initialLastSynced }}>
      {children}
      {currentRun && (
        <ConfirmRunModal
          activity={currentRun}
          plannedSession={currentPlannedSession}
          onConfirm={handleConfirm}
          onDismiss={handleDismiss}
        />
      )}
    </SyncContext.Provider>
  );
}

export function useSync() {
  return useContext(SyncContext);
}
