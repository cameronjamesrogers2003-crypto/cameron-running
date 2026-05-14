"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import NoviceProgressHeader from "@/components/novice/analytics/NoviceProgressHeader";
import NoviceStreakCard from "@/components/novice/analytics/NoviceStreakCard";
import NoviceWeekSelector from "@/components/novice/analytics/NoviceWeekSelector";
import NoviceWeekDetailPanel from "@/components/novice/analytics/NoviceWeekDetailPanel";
import NoviceLongestRunCard from "@/components/novice/analytics/NoviceLongestRunCard";

const NoviceWeeklyVolumeChart = dynamic(() => import("@/components/novice/analytics/NoviceWeeklyVolumeChart"), { ssr: false });
const NoviceEffortTrendChart = dynamic(() => import("@/components/novice/analytics/NoviceEffortTrendChart"), { ssr: false });
const NoviceRunWalkProgressChart = dynamic(() => import("@/components/novice/analytics/NoviceRunWalkProgressChart"), { ssr: false });

type SummaryPayload = {
  totalSessionsCompleted: number;
  totalSessionsPlanned: number;
  totalActualKm: number | null;
  totalPlannedKm: number;
  currentStreak: number;
  bestStreak: number;
  longestRunKm: number | null;
  weeklyVolumes: Array<{
    weekNumber: number;
    plannedKm: number;
    actualKm: number | null;
    completionRate: number;
    adaptiveDecision: string | null;
    isCutback: boolean;
    isRepeat: boolean;
    hasStravaData?: boolean;
  }>;
  sessionRpeHistory: Array<{
    sessionNumber: number;
    weekNumber: number;
    sessionType: string;
    userRpe: number | null;
    effortScore: number | null;
  }>;
  runWalkProgression: Array<{
    weekNumber: number;
    runSec: number;
    walkSec: number;
    isContinuous: boolean;
  }>;
};

type WeekDetail = {
  weekNumber: number;
  phase: string;
  plannedKm: number;
  actualKm: number | null;
  completionRate: number;
  averageRpe: number | null;
  adaptiveMutation: { mutationType: string; decisionReason: string } | null;
  sessions: Array<{
    day: string;
    sessionType: string;
    plannedKm: number;
    actualKm: number | null;
    userRpe: number | null;
    completed: boolean;
    skippedReason: string | null;
  }>;
  weekInsight: string;
};

type Props = {
  goalBadge: string;
  currentWeek: number;
  totalWeeks: number;
  weeksRemaining: number;
  summary: SummaryPayload;
  weekDetails: Record<number, WeekDetail>;
  goalDistanceKm: number;
};

const TABS = ["Overview", "Weekly Detail", "Run/Walk Progress"] as const;
type Tab = (typeof TABS)[number];

export default function NoviceProgressPageClient(props: Props) {
  const [tab, setTab] = useState<Tab>("Overview");
  const [selectedWeek, setSelectedWeek] = useState(props.currentWeek);

  const thisWeekDots = useMemo(() => {
    const d = props.weekDetails[props.currentWeek];
    if (!d) return [] as Array<"done" | "upcoming" | "missed">;
    return d.sessions.map((s) => (s.completed ? "done" : s.skippedReason ? "missed" : "upcoming"));
  }, [props.currentWeek, props.weekDetails]);

  const stateByWeek = useMemo(() => {
    const out: Record<number, "all" | "partial" | "none"> = {};
    for (const [k, detail] of Object.entries(props.weekDetails)) {
      const wk = Number(k);
      const completed = detail.sessions.filter((s) => s.completed).length;
      if (completed === 0) out[wk] = "none";
      else if (completed === detail.sessions.length) out[wk] = "all";
      else out[wk] = "partial";
    }
    return out;
  }, [props.weekDetails]);

  const noCheckins = props.summary.totalSessionsCompleted === 0;
  const noStrava = props.summary.totalActualKm == null;

  return (
    <div className="max-w-[720px] mx-auto w-full px-3 sm:px-4 pb-24">
      <header className="sticky top-0 z-30 -mx-3 sm:-mx-4 px-3 sm:px-4 py-3 bg-[#f5f2eb]/95 backdrop-blur border-b border-black/[0.06] mb-4">
        <div className="flex flex-wrap items-center gap-2 text-sm sm:text-base">
          <span className="rounded-full bg-[#2d6a4f] px-3 py-1 text-xs font-semibold text-white">{props.goalBadge}</span>
          <span className="text-[#334155] font-medium">Week {props.currentWeek} of {props.totalWeeks}</span>
          <span className="text-[#94a3b8]">·</span>
          <span className="text-[#64748b]">{props.weeksRemaining} weeks to go</span>
          <Link href="/program" className="ml-auto text-sm underline text-[#2d6a4f]">Back to plan</Link>
        </div>

        <div className="mt-3 flex gap-2 overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className="shrink-0 rounded-full border px-3 py-1.5 text-sm"
              style={{
                background: tab === t ? "#2d6a4f" : "#fff",
                color: tab === t ? "#fff" : "#475569",
                borderColor: tab === t ? "#2d6a4f" : "rgba(0,0,0,0.12)",
              }}
            >
              {t}
            </button>
          ))}
        </div>
      </header>

      {noCheckins ? (
        <div className="mb-4 rounded-xl border border-[#bbf7d0] bg-[#f0fdf4] px-4 py-3 text-sm text-[#166534]">
          Complete your first session to start tracking progress.
        </div>
      ) : null}
      {noStrava ? (
        <div className="mb-4 rounded-xl border border-[#dbeafe] bg-[#eff6ff] px-4 py-3 text-sm text-[#1e40af]">
          No Strava matches yet — distance totals are shown as estimated where needed.
        </div>
      ) : null}

      {tab === "Overview" ? (
        <div className="space-y-4">
          <NoviceProgressHeader
            currentWeek={props.currentWeek}
            totalWeeks={props.totalWeeks}
            totalSessionsCompleted={props.summary.totalSessionsCompleted}
            totalKmCovered={(props.summary.totalActualKm ?? props.summary.totalPlannedKm)}
            totalActualKmIsEstimated={props.summary.totalActualKm == null}
          />
          <NoviceWeeklyVolumeChart weeks={props.summary.weeklyVolumes} currentWeek={props.currentWeek} />
          <NoviceStreakCard currentStreak={props.summary.currentStreak} bestStreak={props.summary.bestStreak} thisWeekDots={thisWeekDots} />
          <NoviceEffortTrendChart points={props.summary.sessionRpeHistory} />
        </div>
      ) : null}

      {tab === "Weekly Detail" ? (
        <div className="space-y-4">
          <NoviceWeekSelector
            weeks={Object.keys(props.weekDetails).map((w) => Number(w)).sort((a, b) => a - b)}
            selectedWeek={selectedWeek}
            onSelect={setSelectedWeek}
            stateByWeek={stateByWeek}
          />
          <NoviceWeekDetailPanel detail={props.weekDetails[selectedWeek] ?? null} />
        </div>
      ) : null}

      {tab === "Run/Walk Progress" ? (
        <div className="space-y-4">
          <NoviceRunWalkProgressChart rows={props.summary.runWalkProgression} currentWeek={props.currentWeek} />
          <NoviceLongestRunCard longestRunKm={props.summary.longestRunKm} goalDistanceKm={props.goalDistanceKm} />
        </div>
      ) : null}
    </div>
  );
}
