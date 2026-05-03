"use client";

import { useState } from "react";
import { TRAINING_DAYS, type WeekPlan, type DayKey, DAY_KEYS, DAY_LABELS } from "@/lib/plans";
import { format, addDays } from "date-fns";
import ScorePill from "@/components/ScorePill";

interface ProgramTableProps {
  plan: WeekPlan[];
  currentWeek: number;
  planStartDate: Date | null;
  completedDays: Set<string>;
  ratings?: Map<string, number>;
  rftpSecPerKm: number | null;
  recentRatings: Array<{ score: number; avgHeartRate: number | null; distanceKm: number }>;
  weatherByDate: Record<string, { tempC: number; dewPointC: number; humidity: number } | null>;
}

const fmtPace = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")} /km`;
const zoneForType = (type: string) => {
  if (type.includes("tempo") || type.includes("pace")) return "Zone 3 · 149–168 bpm";
  if (type.includes("interval")) return "Zone 4 · 168–182 bpm";
  if (type.includes("race")) return "Zone 5 · 182–198 bpm";
  return "Zone 2 · 119–149 bpm";
};

function details(type: string, week: number) {
  const late = week > 8;
  if (type.includes("long")) return late ? ["Foundation Long Run", "Builds endurance and mental durability."] : ["Aerobic Base Builder", "Builds aerobic durability with low-intensity volume."];
  if (type.includes("race")) return ["Race Simulation Day", "Sharpens race pacing and confidence under effort."];
  if (type.includes("sorta")) return ["Steady Progress Run", "Builds sustainable strength at manageable effort."];
  return late ? ["Keep It Conversational Today", "Reinforces recovery while holding consistent form."] : ["Easy Engine Session", "Builds your aerobic base and efficient fat burning."];
}

export default function ProgramTable({ plan, currentWeek, planStartDate, completedDays, ratings, rftpSecPerKm, recentRatings, weatherByDate }: ProgramTableProps) {
  const [openWeeks, setOpenWeeks] = useState<Set<number>>(new Set([currentWeek]));
  const rftp = rftpSecPerKm ?? 395;

  const avgHr = recentRatings.length ? recentRatings.reduce((s, r) => s + (r.avgHeartRate ?? 0), 0) / recentRatings.length : null;
  const lowScore = recentRatings.some((r) => r.score < 6);

  function tips(workoutDistance?: number, dateKey?: string) {
    const t = ["Run at a pace where you can hold a full conversation"];
    if (avgHr && avgHr > 168) t.push("Your HR has been running high lately — keep this one controlled and slower than ego pace");
    if (lowScore) t.push("Last run looked tough — today is recovery execution, not performance");
    if (workoutDistance && recentRatings.length && recentRatings[0].distanceKm < workoutDistance * 0.8) t.push("You’ve been cutting runs short — prioritize full distance today, even if slower");
    const wx = dateKey ? weatherByDate[dateKey] : null;
    if (wx?.tempC && wx?.dewPointC && wx.tempC > 35) t.push("Extreme heat — consider running before 7am or moving this session indoors");
    else if (wx?.tempC && wx?.dewPointC && wx.tempC > 30 && wx.dewPointC > 20) t.push("Hot and humid today — widen your pace target by ~8% and prioritise HR over pace");
    return t.slice(0, 3);
  }

  return <div className="space-y-3 p-3">{plan.map((week, weekIdx) => {
    const isCurrent = week.week === currentWeek;
    const isPast = currentWeek > week.week;
    const isFuture = week.week > currentWeek;
    const expanded = isCurrent || openWeeks.has(week.week);
    return <div key={week.week} className="rounded-xl" style={{ background: "var(--surface)", border: `1px solid ${isCurrent ? "rgba(249,115,22,0.4)" : "var(--border)"}`, opacity: isPast ? 0.65 : 1 }}>
      <button className="w-full px-4 py-3 flex items-center justify-between text-left" onClick={() => isFuture && setOpenWeeks((prev) => new Set(prev.has(week.week) ? [...prev].filter((w) => w !== week.week) : [...prev, week.week]))}>
        <div><p className="text-sm font-semibold text-white">Week {week.week} {isCurrent ? "• Current" : isPast ? "• Completed" : ""}</p></div>
      </button>
      {expanded && <div className="px-4 pb-4 space-y-3">{(DAY_KEYS as DayKey[]).filter((d) => TRAINING_DAYS.has(d)).map((day, dayIdx) => {
        const workout = week[day];
        const date = planStartDate ? addDays(planStartDate, weekIdx * 7 + dayIdx) : null;
        const dateKey = date ? date.toISOString().split("T")[0] : "";
        const done = dateKey ? completedDays.has(dateKey) : false;
        const [name, desc] = details(workout.type, week.week);
        const low = workout.type === "long" ? rftp + 75 : workout.type.includes("tempo") || workout.type.includes("pace") ? rftp + 15 : rftp + 60;
        const high = workout.type === "long" ? rftp + 120 : workout.type.includes("tempo") || workout.type.includes("pace") ? rftp + 30 : rftp + 90;
        const zoneName = high > rftp + 120 ? "Recovery Jog" : high >= rftp + 60 ? "Easy Zone" : high >= rftp + 30 ? "Comfortable" : high >= rftp ? "Moderate Push" : "Threshold +";
        const wx = dateKey ? weatherByDate[dateKey] : null;
        const heatBadge = wx?.tempC && wx.dewPointC && wx.tempC > 35 ? "Extreme Heat" : wx?.tempC && wx.dewPointC && wx.tempC > 30 && wx.dewPointC > 20 ? "Heat Advisory" : null;

        return <div key={day} className="rounded-lg p-3" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
          <div className="flex justify-between"><p className="text-xs" style={{ color: "var(--text-muted)" }}>{DAY_LABELS[day]} {date ? format(date, "d MMM") : ""}</p>{heatBadge && <span className="text-xs px-2 py-0.5 rounded" style={{ background: heatBadge === "Extreme Heat" ? "rgba(239,68,68,0.2)" : "rgba(245,158,11,0.2)", color: heatBadge === "Extreme Heat" ? "#f87171" : "#f59e0b" }}>{heatBadge}</span>}</div>
          <p className="text-sm font-semibold text-white">{workout.distanceKm?.toFixed(1)} km · {name}</p>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>{desc}</p>
          <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Target HR: {zoneForType(workout.type)} · Pace: {zoneName} · {fmtPace(low)}–{fmtPace(high)}</p>
          <ul className="mt-1 list-disc pl-4">{tips(workout.distanceKm, dateKey).map((tip) => <li key={tip} className="text-xs" style={{ color: "var(--text-muted)" }}>{tip}</li>)}</ul>
          {done && <div className="mt-1">{ratings?.get(dateKey) !== undefined ? <ScorePill score={ratings.get(dateKey)!} size="xs" /> : <span style={{ color: "var(--accent)" }}>✓ Completed</span>}</div>}
        </div>;
      })}</div>}
      {!expanded && isFuture && <div className="px-4 pb-3 space-y-1">{(["wed", "sat", "sun"] as DayKey[]).map((d, i) => {
        const w = week[d];
        const [name] = details(w.type, week.week);
        const date = planStartDate ? addDays(planStartDate, weekIdx * 7 + i + 2) : null;
        return <p key={d} className="text-xs" style={{ color: "var(--text-muted)" }}>{date ? format(date, "d MMM") : DAY_LABELS[d]} · {w.distanceKm?.toFixed(1)} km · {name}</p>;
      })}</div>}
    </div>;
  })}</div>;
}
