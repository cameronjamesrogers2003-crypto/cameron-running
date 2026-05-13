"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, Cell } from "recharts";

type Row = { weekNumber: number; runSec: number; walkSec: number; isContinuous: boolean };
type Props = { rows: Row[]; currentWeek: number };

type ChartRow = {
  week: string;
  weekNumber: number;
  runPct: number;
  walkPct: number;
  runSec: number;
  walkSec: number;
  isContinuous: boolean;
  shade: number;
};

function runPct(row: Row): number {
  if (row.isContinuous) return 100;
  const total = row.runSec + row.walkSec;
  return total > 0 ? (row.runSec / total) * 100 : 100;
}

export default function NoviceRunWalkProgressChart({ rows, currentWeek }: Props) {
  const upToCurrent = rows.filter((r) => r.weekNumber <= currentWeek);
  const transitionWeek = rows.find((r) => r.isContinuous)?.weekNumber ?? 0;

  const data: ChartRow[] = upToCurrent.map((r, i, arr) => {
    const p = runPct(r);
    return {
      week: `Week ${r.weekNumber}`,
      weekNumber: r.weekNumber,
      runPct: Number(p.toFixed(1)),
      walkPct: Number((100 - p).toFixed(1)),
      runSec: r.runSec,
      walkSec: r.walkSec,
      isContinuous: r.isContinuous,
      shade: 0.45 + (0.45 * i) / Math.max(1, arr.length - 1),
    };
  });

  const milestones: string[] = [];
  if (data.length >= 1) milestones.push("Week 1 → You started with 40% running. That took courage.");
  const half = data.find((d) => d.runPct >= 50);
  if (half) milestones.push(`Week ${half.weekNumber} → You hit 50/50 for the first time.`);
  const continuous = data.find((d) => d.isContinuous);
  if (continuous) milestones.push(`Week ${continuous.weekNumber} → You ran continuously for the first time.`);

  return (
    <section className="rounded-2xl bg-[#faf8f5] border border-black/[0.06] p-4 sm:p-5 shadow-sm">
      <h3 className="text-base font-semibold text-[#1e293b]">More running, less walking — every week.</h3>

      <div className="mt-4 h-[280px] min-w-[360px] sm:min-w-0 overflow-x-auto">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 10, right: 10, left: 8, bottom: 10 }}>
            <XAxis type="number" domain={[0, 100]} hide />
            <YAxis dataKey="week" type="category" tick={{ fill: "#64748b", fontSize: 11 }} width={70} />
            <Tooltip />
            {transitionWeek > 0 ? (
              <ReferenceLine
                y={`Week ${transitionWeek}`}
                stroke="#64748b"
                strokeDasharray="4 4"
                label={{ value: "Continuous running begins →", fill: "#64748b", fontSize: 10, position: "insideTopRight" }}
              />
            ) : null}
            <Bar dataKey="runPct" stackId="a">
              {data.map((d, i) => (
                <Cell key={`run-${i}`} fill={`rgba(45,106,79,${d.shade})`} />
              ))}
            </Bar>
            <Bar dataKey="walkPct" stackId="a" fill="#d1d5db" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {milestones.length > 0 ? (
        <div className="mt-4 space-y-1 text-sm text-[#475569]">
          {milestones.slice(0, 3).map((m) => (
            <p key={m}>{m}</p>
          ))}
        </div>
      ) : null}
    </section>
  );
}
