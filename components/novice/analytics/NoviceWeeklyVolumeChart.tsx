"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, Cell } from "recharts";
import { Repeat2, ArrowDown } from "lucide-react";

type WeekVolume = {
  weekNumber: number;
  plannedKm: number;
  actualKm: number | null;
  completionRate: number;
  adaptiveDecision: string | null;
  isCutback: boolean;
  isRepeat: boolean;
  hasStravaData?: boolean;
};

type Props = { weeks: WeekVolume[]; currentWeek: number };

type ChartRow = {
  week: string;
  barValue: number;
  plannedKm: number;
  actualKm: number | null;
  completionRate: number;
  adaptiveDecision: string | null;
  isFuture: boolean;
  isCurrent: boolean;
  isEstimated: boolean;
};

function getHeadline(weeks: WeekVolume[], currentWeek: number): string {
  if (currentWeek < 4) return "Your weekly volume is building.";
  const w1 = weeks.find((w) => w.weekNumber === 1);
  const cw = weeks.find((w) => w.weekNumber === currentWeek);
  const a1 = w1?.actualKm ?? w1?.plannedKm ?? 0;
  const ac = cw?.actualKm ?? cw?.plannedKm ?? 0;
  const delta = (ac - a1) / Math.max(1, currentWeek - 1);
  return `You've added ${delta.toFixed(1)} km per week since you started.`;
}

export default function NoviceWeeklyVolumeChart({ weeks, currentWeek }: Props) {
  const peakPlanned = Math.max(...weeks.map((w) => w.plannedKm));
  const hasPassedPeak = weeks.some((w) => w.weekNumber < currentWeek && (w.actualKm ?? w.plannedKm) >= peakPlanned);
  const current = weeks.find((w) => w.weekNumber === currentWeek);
  const currentLabel = hasPassedPeak && current ? `Your peak: ${(current.actualKm ?? current.plannedKm).toFixed(1)} km` : "Peak week";

  const chartData: ChartRow[] = weeks.map((w) => ({
    week: `W${w.weekNumber}`,
    barValue: w.actualKm ?? (w.weekNumber <= currentWeek ? w.plannedKm : 0),
    plannedKm: w.plannedKm,
    actualKm: w.actualKm,
    completionRate: w.completionRate,
    adaptiveDecision: w.adaptiveDecision,
    isFuture: w.weekNumber > currentWeek,
    isCurrent: w.weekNumber === currentWeek,
    isEstimated: w.weekNumber <= currentWeek && w.actualKm == null,
  }));

  return (
    <section className="rounded-2xl bg-[#faf8f5] border border-black/[0.06] p-4 sm:p-5 shadow-sm">
      <h3 className="text-base font-semibold text-[#1e293b]">{getHeadline(weeks, currentWeek)}</h3>

      <div className="mt-4 h-[240px] min-w-[360px] sm:min-w-0 overflow-x-auto">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 10, right: 8, left: -20, bottom: 22 }}>
            <XAxis dataKey="week" tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis hide />
            <Tooltip cursor={{ fill: "rgba(45,106,79,0.08)" }} />
            <ReferenceLine y={peakPlanned} stroke="#64748b" strokeDasharray="4 4" label={{ value: currentLabel, position: "right", fill: "#64748b", fontSize: 10 }} />
            <Bar dataKey="barValue" radius={[6, 6, 0, 0]}>
              {chartData.map((w, i) => (
                <Cell
                  key={`cell-${i}`}
                  fill={w.isFuture ? "rgba(148,163,184,0.10)" : w.isCurrent ? "rgba(45,106,79,0.65)" : w.isEstimated ? "rgba(45,106,79,0.35)" : "#2d6a4f"}
                  stroke={w.isFuture ? "rgba(148,163,184,0.45)" : "none"}
                  strokeWidth={w.isFuture ? 1 : 0}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-2 flex flex-wrap gap-4 text-xs text-[#64748b]">
        {weeks.some((w) => w.isCutback) ? <span className="inline-flex items-center gap-1"><ArrowDown className="w-3 h-3" /> cutback week</span> : null}
        {weeks.some((w) => w.isRepeat) ? <span className="inline-flex items-center gap-1"><Repeat2 className="w-3 h-3" /> repeat week</span> : null}
      </div>
    </section>
  );
}
