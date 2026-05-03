"use client";

import { useState, useEffect, useTransition } from "react";
import { plans, getPlanInfo, getCurrentPlanWeek, type PlanId } from "@/lib/plans";
import { getSeasonalTip } from "@/lib/weather";
import ProgramTable from "@/components/ProgramTable";
import { format } from "date-fns";

interface Settings {
  activePlan?: string;
  planStartDate?: string | null;
  halfCompleted?: boolean;
}

interface Activity {
  id: string;
  date: string;
  distanceKm: number;
  activityType: string;
}

interface RatingEntry {
  date: string;
  score: number;
}

interface ProgramContext {
  rftpSecPerKm: number | null;
  recentRatings: Array<{ score: number; avgHeartRate: number | null; distanceKm: number }>;
  weatherByDate: Record<string, { tempC: number; dewPointC: number; humidity: number } | null>;
}

export const dynamic = "force-dynamic";

export default function ProgramPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [ratingsMap, setRatingsMap] = useState<Map<string, number>>(new Map());
  const [startInput, setStartInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [programContext, setProgramContext] = useState<ProgramContext | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/settings").then((r) => r.json()),
      fetch("/api/activities?all=1").then((r) => r.json()),
      fetch("/api/ratings").then((r) => r.json()).catch(() => []),
      fetch("/api/program-context").then((r) => r.json()).catch(() => null),
    ]).then(([s, a, ratings, context]) => {
      setSettings(s);
      setActivities(Array.isArray(a) ? a : []);
      if (s.planStartDate) {
        setStartInput(format(new Date(s.planStartDate), "yyyy-MM-dd"));
      }
      const map = new Map<string, number>();
      if (Array.isArray(ratings)) {
        for (const r of ratings as RatingEntry[]) {
          const dateStr = new Date(r.date).toISOString().split("T")[0];
          map.set(dateStr, r.score);
        }
      }
      setRatingsMap(map);
      setProgramContext(context);
    });
  }, []);

  const planId: PlanId = (settings?.activePlan as PlanId) ?? "half";
  const plan = plans[planId];
  const info = getPlanInfo(planId);
  const planStartDate = settings?.planStartDate ? new Date(settings.planStartDate) : null;
  const currentWeek = planStartDate ? getCurrentPlanWeek(planStartDate, new Date()) : 0;
  const monthTip = getSeasonalTip(new Date().getMonth() + 1);

  const completedDays = new Set<string>();
  if (planStartDate) {
    activities
      .filter((a) => a.activityType === "running" || a.activityType === "trail_running")
      .forEach((a) => {
        const d = new Date(a.date);
        completedDays.add(d.toISOString().split("T")[0]);
      });
  }

  async function saveStartDate() {
    if (!startInput) return;
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planStartDate: new Date(startInput).toISOString() }),
      });
      if (res.ok) {
        const s = await res.json();
        startTransition(() => setSettings(s));
      }
    } finally {
      setSaving(false);
    }
  }

  async function markHalfComplete() {
    setSaving(true);
    try {
      await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          halfCompleted: true,
          halfCompletedAt: new Date().toISOString(),
        }),
      });
      const s = await fetch("/api/settings").then((r) => r.json());
      setSettings(s);
    } finally {
      setSaving(false);
    }
  }

  async function switchToMarathon() {
    setSaving(true);
    try {
      await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activePlan: "marathon", planStartDate: new Date().toISOString() }),
      });
      const s = await fetch("/api/settings").then((r) => r.json());
      setSettings(s);
    } finally {
      setSaving(false);
    }
  }

  if (!settings) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-6 h-6 rounded-full border-2 border-orange-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Phase banner */}
      <div
        className="rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
            Active Plan
          </p>
          <p className="text-lg font-bold text-white mt-0.5">
            {info.name} — {info.weeks} weeks
          </p>
          {currentWeek > 0 && currentWeek <= plan.length && (
            <p className="text-sm mt-0.5" style={{ color: "var(--accent)" }}>
              Currently on Week {currentWeek}
            </p>
          )}
        </div>
        <div className="flex gap-2 flex-wrap">
          {planId === "half" && !settings.halfCompleted && currentWeek >= plan.length && (
            <button
              onClick={markHalfComplete}
              disabled={saving}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
              style={{ background: "#10b981" }}
            >
              ✓ Mark Half Complete
            </button>
          )}
          {planId === "half" && settings.halfCompleted && (
            <button
              onClick={switchToMarathon}
              disabled={saving}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
              style={{ background: "var(--accent)" }}
            >
              Switch to Marathon Plan →
            </button>
          )}
        </div>
      </div>

      {/* Seasonal tip */}
      <div
        className="rounded-xl px-4 py-3 text-sm"
        style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-muted)" }}
      >
        <span className="font-semibold text-white">Brisbane tip: </span>
        {monthTip}
      </div>

      {/* Start date picker */}
      <div
        className="rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-4"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <div className="flex-1">
          <p className="text-sm font-semibold text-white">Plan Start Date</p>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
            All week numbers calculate from this date
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <input
            type="date"
            value={startInput}
            onChange={(e) => setStartInput(e.target.value)}
            className="rounded-lg px-3 py-2 text-sm text-white outline-none"
            style={{
              background: "var(--surface-2)",
              border: "1px solid var(--border)",
              colorScheme: "dark",
            }}
          />
          <button
            onClick={saveStartDate}
            disabled={saving || isPending}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
            style={{ background: "var(--accent)" }}
          >
            Save
          </button>
        </div>
      </div>

      {/* Plan table */}
      <div
        className="rounded-xl overflow-hidden"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <div className="px-4 pt-4 pb-2">
          <h2 className="text-sm font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
            Week by Week
          </h2>
        </div>
        <ProgramTable
          plan={plan}
          currentWeek={currentWeek}
          planStartDate={planStartDate}
          completedDays={completedDays}
          ratings={ratingsMap}
          rftpSecPerKm={programContext?.rftpSecPerKm ?? null}
          recentRatings={programContext?.recentRatings ?? []}
          weatherByDate={programContext?.weatherByDate ?? {}}
        />
      </div>
    </div>
  );
}
