"use client";

import { useState } from "react";
import { Activity } from "@prisma/client";
import { Session } from "@/data/trainingPlan";
import { RunTypePill } from "@/components/RunTypePill";
import { formatPace, formatDuration } from "@/lib/strava";

interface ConfirmRunModalProps {
  activity: Activity;
  plannedSession?: Session | null;
  onConfirm: (confirmedType: string, linkedSessionId?: string) => void;
  onDismiss: () => void;
}

export default function ConfirmRunModal({
  activity,
  plannedSession,
  onConfirm,
  onDismiss,
}: ConfirmRunModalProps) {
  const [selectedType, setSelectedType] = useState<string>(activity.classifiedRunType || "easy");
  const [isPlanned, setIsPlanned] = useState<boolean>(
    plannedSession ? activity.classifiedRunType === plannedSession.type : false
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleConfirm = async () => {
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/runs/${activity.id}/confirm`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          confirmedRunType: selectedType,
          linkedSessionId: isPlanned && plannedSession ? plannedSession.id : null,
        }),
      });
      if (response.ok) {
        onConfirm(selectedType, isPlanned && plannedSession ? plannedSession.id : undefined);
      }
    } catch (err) {
      console.error("Failed to confirm run:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const runTypes = [
    { id: "easy", label: "Easy" },
    { id: "tempo", label: "Tempo" },
    { id: "interval", label: "Interval" },
    { id: "long", label: "Long Run" },
  ];

  const dateStr = new Date(activity.date).toLocaleDateString("en-AU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg bg-[#111] border border-white/10 rounded-3xl overflow-hidden shadow-2xl animate-fadeInUp">
        <div className="p-6 space-y-6">
          <div className="space-y-1">
            <h1 className="text-xl font-black tracking-tight">New run detected</h1>
            <p className="ty-date">{dateStr}</p>
          </div>

          <div className="bg-white/5 rounded-2xl p-4 flex items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-baseline gap-2">
                <span className="ty-stat">{(activity.distanceKm).toFixed(1)} km</span>
                <span className="ty-stat-label">at</span>
                <span className="ty-stat">{formatPace(activity.avgPaceSecKm)}</span>
              </div>
              <p className="ty-stat-label">{formatDuration(activity.durationSecs)}</p>
            </div>
            <div className="text-right space-y-1">
              <p className="ty-stat-label">Classified as</p>
              <RunTypePill type={activity.classifiedRunType} />
            </div>
          </div>

          <div className="space-y-3">
            <p className="ty-label">Confirm run type</p>
            <div className="grid grid-cols-2 gap-2">
              {runTypes.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setSelectedType(t.id)}
                  className={`px-4 py-3 rounded-xl text-sm font-bold transition-all border ${
                    selectedType === t.id
                      ? "bg-accent text-black border-accent"
                      : "bg-white/5 text-white/60 border-transparent hover:border-white/10"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {plannedSession && (
            <div className="space-y-3">
              <p className="ty-label">Planned Session</p>
              <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="ty-run-name capitalize">{plannedSession.type} session</p>
                    <p className="ty-stat-label">Target: {plannedSession.targetDistanceKm}km</p>
                  </div>
                  <RunTypePill type={plannedSession.type} size="sm" />
                </div>
                
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/5">
                  <button
                    onClick={() => setIsPlanned(true)}
                    className={`px-3 py-2 rounded-lg text-xs font-bold border transition-all ${
                      isPlanned
                        ? "bg-white/10 border-white/20 text-white"
                        : "border-transparent text-white/40"
                    }`}
                  >
                    Match to plan
                  </button>
                  <button
                    onClick={() => setIsPlanned(false)}
                    className={`px-3 py-2 rounded-lg text-xs font-bold border transition-all ${
                      !isPlanned
                        ? "bg-white/10 border-white/20 text-white"
                        : "border-transparent text-white/40"
                    }`}
                  >
                    Extra run
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-2 pt-4">
            <button
              onClick={handleConfirm}
              disabled={isSubmitting}
              className="w-full py-4 rounded-2xl bg-accent text-black font-black text-base hover:bg-accent-hover transition-colors disabled:opacity-50"
            >
              {isSubmitting ? "Confirming..." : "Confirm"}
            </button>
            <button
              onClick={onDismiss}
              disabled={isSubmitting}
              className="w-full py-4 rounded-2xl text-white/50 font-bold text-sm hover:text-white transition-colors"
            >
              Skip for now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
