"use client";

import { TRAINING_DAYS, type WeekPlan, type DayKey, DAY_KEYS, DAY_LABELS } from "@/lib/plans";
import { format, addDays } from "date-fns";
import ScorePill from "@/components/ScorePill";

interface SessionView {
  id: string;
  date: string;
  status: "SCHEDULED" | "COMPLETED" | "MISSED" | "SKIPPED";
  currentDistanceKm: number;
  originalDistanceKm: number;
  targetPaceMinKmLow: number | null;
  targetPaceMinKmHigh: number | null;
  targetHrZone: number | null;
  isAdjusted: boolean;
  triggerReason: string | null;
  activity: { avgPaceSecKm: number; avgHeartRate: number | null } | null;
  rating: { score: number; paceScore: number; hrScore: number; executionScore: number } | null;
}
interface ProgramTableProps { plan: WeekPlan[]; currentWeek: number; planStartDate: Date | null; completedDays: Set<string>; ratings?: Map<string, number>; scheduledSessions?: SessionView[]; rftpSecPerKm: number | null; recentRatings: Array<{ score: number; avgHeartRate: number | null; distanceKm: number }>; weatherByDate: Record<string, { tempC: number; dewPointC: number; humidity: number } | null>; }

const z = (zone: number) => [95, 110, 125, 145, 165, 185][Math.max(0, Math.min(5, zone - 1))];
const coachingNote = (reason?: string | null) => {
  if (!reason) return "Adjustment applied to protect consistency while maintaining training intent.";
  if (reason.includes("injury_signal") || reason.includes("hr_trend")) return "Your recent effort markers suggest strain, so today is softened to preserve recovery.";
  if (reason.includes("acwr")) return "Your load rose quickly this week, so this run is reduced to avoid overload.";
  if (reason.includes("missed_long_run")) return "A missed key session shifts today toward control so fitness can rebuild safely.";
  if (reason.includes("two_consecutive")) return "Back-to-back tough sessions prompted a lighter prescription to restore readiness.";
  return `Triggered by ${reason.replaceAll("_", " ")}, so today is adjusted to keep the plan sustainable.`;
};

function TrainingCell({ workout, isToday, done, date, rating, session }: { workout: import("@/lib/plans").DayWorkout; isToday: boolean; done: boolean; date?: Date; rating?: number; session?: SessionView; }) {
  const missed = session?.status === "MISSED";
  const adjusted = Boolean(session?.isAdjusted);
  const distDiff = adjusted ? session!.currentDistanceKm - session!.originalDistanceKm : 0;
  const distPct = adjusted && session!.originalDistanceKm ? Math.abs(distDiff) / session!.originalDistanceKm : 0;
  const paceDiffSec = adjusted && session!.targetPaceMinKmLow !== null && session!.targetPaceMinKmHigh !== null
    ? Math.round((((session!.targetPaceMinKmLow + session!.targetPaceMinKmHigh) / 2) - ((session!.targetPaceMinKmLow + session!.targetPaceMinKmHigh) / 2)) * 60)
    : 0;
  const dir = distDiff < 0 ? "Adjusted ↓" : "Adjusted ↑";

  const paceColor = (() => {
    if (!session?.activity || session.targetPaceMinKmLow === null || session.targetPaceMinKmHigh === null) return null;
    const p = session.activity.avgPaceSecKm / 60;
    if (p >= session.targetPaceMinKmLow && p <= session.targetPaceMinKmHigh) return "#22c55e";
    const nearest = p < session.targetPaceMinKmLow ? session.targetPaceMinKmLow : session.targetPaceMinKmHigh;
    return Math.abs(p - nearest) / nearest > 0.15 ? "#ef4444" : "#f59e0b";
  })();

  const hrColor = (() => {
    if (!session?.activity?.avgHeartRate || !session.targetHrZone) return null;
    const target = z(session.targetHrZone);
    const delta = Math.abs(session.activity.avgHeartRate - target) / target;
    return delta > 0.15 ? "#ef4444" : delta > 0 ? "#f59e0b" : "#22c55e";
  })();

  const summary = session?.rating
    ? session.rating.executionScore >= 0.85 ? "Great execution"
      : session.rating.paceScore >= 0.8 && session.rating.hrScore >= 0.8 ? "On target"
      : session.rating.paceScore < 0.6 ? "Slightly fast"
      : session.rating.hrScore < 0.6 ? "Too hard"
      : "Solid work"
    : null;

  return <td className="p-1.5" style={{ width: 120 }}><div className="rounded-lg p-2 text-xs relative group" style={{ background: done ? "rgba(249,115,22,0.1)" : "var(--surface-2)", border: isToday ? "2px solid var(--accent)" : "1px solid var(--border)", minHeight: 60 }}>
    {date && <p style={{ color: "var(--text-muted)", fontSize: "0.6rem" }} className="mb-1">{format(date, "d MMM")}</p>}
    {missed ? <p className="font-semibold text-white">{workout.label}<span className="ml-1 px-1.5 py-0.5 rounded" style={{ background: "rgba(239,68,68,0.15)", color: "#fca5a5" }}>Missed</span></p> : <>
      <p className="font-semibold text-white leading-tight">{workout.distanceKm ? `${workout.distanceKm.toFixed(1)} km` : workout.label}</p>
      <p className="mt-0.5 capitalize" style={{ color: "var(--text-muted)", fontSize: "0.6rem" }}>{workout.type === "sorta_long" ? "sorta long" : workout.type.replace("race_", "")}</p>
    </>}

    {adjusted && <div className="absolute top-1 right-1.5">
      <span className="rounded px-1 py-0.5" style={{ background: distPct >= 0.15 ? "rgba(239,68,68,0.2)" : "rgba(245,158,11,0.2)", color: distPct >= 0.15 ? "#fca5a5" : "#fcd34d", fontSize: "0.55rem" }}>{dir}</span>
      <div className="hidden group-hover:block absolute right-0 mt-1 w-48 p-2 rounded z-10" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <p style={{ color: "var(--text-muted)" }}>{`${distDiff >= 0 ? "+" : ""}${distDiff.toFixed(1)}km · ${paceDiffSec >= 0 ? "+" : ""}${paceDiffSec}s/km · Z${session?.targetHrZone ?? "?"} only`}</p>
        <p className="mt-1 text-white">{session?.triggerReason ?? "No trigger captured"}</p>
        <p className="mt-1" style={{ color: "var(--text-muted)" }}>{coachingNote(session?.triggerReason)}</p>
      </div>
    </div>}

    {session?.status === "COMPLETED" && session.rating && session.activity && <div className="mt-1 space-y-1">
      <p style={{ color: paceColor ?? "var(--text-muted)" }}>Pace {Math.round(session.activity.avgPaceSecKm / 60)}:{String(session.activity.avgPaceSecKm % 60).padStart(2, "0")} vs {session.targetPaceMinKmLow ?? "-"}-{session.targetPaceMinKmHigh ?? "-"}/km</p>
      <p style={{ color: hrColor ?? "var(--text-muted)" }}>HR {session.activity.avgHeartRate ?? "-"} vs Z{session.targetHrZone ?? "-"}</p>
      <ScorePill score={session.rating.score} size="xs" />
      <p style={{ color: "var(--text-muted)", fontSize: "0.6rem" }}>{summary}</p>
    </div>}

    {done && rating === undefined && <span className="absolute top-1 right-1.5 text-xs font-bold" style={{ color: "var(--accent)" }}>✓</span>}
    {isToday && !done && workout.type !== "rest" && <span className="absolute top-1 right-1.5 text-xs font-bold" style={{ color: "var(--accent)", fontSize: "0.55rem" }}>TODAY</span>}
  </div></td>;
}

function RestCell({ isToday }: { isToday: boolean }) { return <td className="p-1" style={{ width: 36 }}><div className="flex items-center justify-center rounded text-xs" style={{ height: 60, background: isToday ? "rgba(249,115,22,0.05)" : "transparent", border: isToday ? "1px solid rgba(249,115,22,0.3)" : "1px solid transparent", color: "var(--border)" }}>—</div></td>; }

export default function ProgramTable({ plan, currentWeek, planStartDate, completedDays, ratings, scheduledSessions = [], rftpSecPerKm, recentRatings, weatherByDate }: ProgramTableProps) {
  const byDate = new Map(scheduledSessions.map((s) => [new Date(s.date).toISOString().split("T")[0], s]));
  function getDate(weekIdx: number, dayIdx: number): Date | undefined { if (!planStartDate) return undefined; return addDays(planStartDate, weekIdx * 7 + dayIdx); }
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return <div className="overflow-x-auto"><table className="border-collapse" style={{ minWidth: 560 }}><thead><tr><th className="text-left px-3 py-2 text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)", width: 56 }}>Week</th>{DAY_KEYS.map((day) => {const isTraining = TRAINING_DAYS.has(day); return <th key={day} className="py-2 text-xs font-semibold uppercase tracking-wider text-center" style={{ color: isTraining ? "var(--text-muted)" : "var(--border)", width: isTraining ? 120 : 36, paddingLeft: isTraining ? 6 : 0, paddingRight: isTraining ? 6 : 0 }}>{DAY_LABELS[day]}</th>;})}</tr></thead><tbody>{plan.map((week, weekIdx) => { const isCurrentWeek = week.week === currentWeek; return <tr key={week.week} style={{ background: isCurrentWeek ? "rgba(249,115,22,0.04)" : "transparent" }}><td className="px-3 py-1"><div className="flex items-center gap-1.5"><span className="text-sm font-bold" style={{ color: isCurrentWeek ? "var(--accent)" : "var(--text-muted)" }}>{week.week}</span>{isCurrentWeek && <span className="rounded-full font-semibold" style={{ background: "var(--accent)", color: "#fff", fontSize: "0.55rem", padding: "2px 5px" }}>NOW</span>}</div></td>{(DAY_KEYS as DayKey[]).map((dayKey, dayIdx) => { const date = getDate(weekIdx, dayIdx); let isToday=false, done=false; if(date){const d=new Date(date);d.setHours(0,0,0,0); isToday=d.getTime()===today.getTime(); done=completedDays.has(d.toISOString().split("T")[0]); } if(!TRAINING_DAYS.has(dayKey)) return <RestCell key={dayKey} isToday={isToday} />; const dateStr=date?new Date(date).toISOString().split("T")[0]:undefined; const rating=dateStr?ratings?.get(dateStr):undefined; const session=dateStr?byDate.get(dateStr):undefined; return <TrainingCell key={dayKey} workout={week[dayKey]} isToday={isToday} done={done} date={date} rating={rating} session={session} />; })}</tr>; })}</tbody></table></div>;
}
