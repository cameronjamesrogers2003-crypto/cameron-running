"use client";

import { useState, useEffect, useCallback } from "react";
import { Activity } from "@prisma/client";
import { Session } from "@/data/trainingPlan";

export function useConfirmRunQueue(newActivityIds: string[]) {
  const [queue, setQueue] = useState<string[]>([]);
  const [currentContext, setCurrentContext] = useState<{
    activity: Activity;
    plannedSession: Session | null;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // When new IDs arrive, add them to the queue
  useEffect(() => {
    if (newActivityIds.length > 0) {
      setQueue((prev) => {
        const newIds = newActivityIds.filter(id => !prev.includes(id));
        return [...prev, ...newIds];
      });
    }
  }, [newActivityIds]);

  const fetchNextContext = useCallback(async (id: string) => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/runs/${id}/confirm-context`);
      if (res.ok) {
        const data = await res.json();
        setCurrentContext(data);
      }
    } catch (err) {
      console.error("Failed to fetch confirm context:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch context for the first item in the queue if we don't have one
  useEffect(() => {
    if (queue.length > 0 && !currentContext && !isLoading) {
      fetchNextContext(queue[0]);
    }
  }, [queue, currentContext, isLoading, fetchNextContext]);

  const advanceQueue = useCallback(() => {
    setQueue((prev) => prev.slice(1));
    setCurrentContext(null);
  }, []);

  const handleConfirm = useCallback(() => {
    advanceQueue();
  }, [advanceQueue]);

  const handleDismiss = useCallback(() => {
    advanceQueue();
  }, [advanceQueue]);

  return {
    currentRun: currentContext?.activity || null,
    currentPlannedSession: currentContext?.plannedSession || null,
    handleConfirm,
    handleDismiss,
    isQueueEmpty: queue.length === 0,
    isLoading,
  };
}
