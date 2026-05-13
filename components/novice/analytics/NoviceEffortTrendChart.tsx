"use client";

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceArea } from "recharts";
import { computeRpeTrendSlope } from "@/lib/noviceAnalytics";

type Point = {
  sessionNumber: number;
  weekNumber: number;
  sessionType: string;
  userRpe: number | null;
  effortScore: number | null;
};

type Props = { points: Point[] };
type DotProps = { cx?: number; cy?: number; payload?: Point };

function trendCopy(slope: number): string {
  if (slope < -0.1) return "Your effort is trending down — the same runs are getting easier.";
  if (slope > 0.1) return "Your effort is trending up. Make sure you're recovering between sessions.";
  return "Your effort has been consistent. That's a good sign.";
}

export default function NoviceEffortTrendChart({ points }: Props) {
  const rpePoints = points.filter((p) => p.userRpe != null);
  if (rpePoints.length < 4) {
    return (
      <section className="rounded-2xl bg-[#faf8f5] border border-black/[0.06] p-4 sm:p-5 shadow-sm">
        <h3 className="text-base font-semibold text-[#1e293b]">Is it getting easier?</h3>
        <p className="mt-2 text-sm text-[#64748b]">Not enough data yet. Keep logging your sessions — your effort trend will appear here after a few more runs.</p>
      </section>
    );
  }

  const recent = rpePoints.slice(-Math.max(4, Math.min(12, rpePoints.length)));
  const slope = computeRpeTrendSlope(recent.map((p, i) => ({ x: i + 1, y: p.userRpe ?? 0 })));

  return (
    <section className="rounded-2xl bg-[#faf8f5] border border-black/[0.06] p-4 sm:p-5 shadow-sm">
      <h3 className="text-base font-semibold text-[#1e293b]">Is it getting easier?</h3>
      <p className="mt-1 text-sm text-[#64748b]">{trendCopy(slope)}</p>

      <div className="mt-4 h-[240px] min-w-[360px] sm:min-w-0 overflow-x-auto">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={points} margin={{ top: 10, right: 12, left: -20, bottom: 10 }}>
            <ReferenceArea y1={3} y2={5} fill="rgba(45,106,79,0.10)" />
            <XAxis dataKey="sessionNumber" tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis domain={[1, 10]} tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip cursor={{ stroke: "rgba(45,106,79,0.2)" }} />
            <Line
              type="monotone"
              dataKey="userRpe"
              stroke="#b45309"
              strokeWidth={2}
              dot={(p: DotProps) => {
                const y = p.payload?.userRpe;
                if (y == null || p.cx == null || p.cy == null) return null;
                const fill = y > 6 ? "#d97706" : y < 3 ? "#3b82f6" : "#b45309";
                return <circle cx={p.cx} cy={p.cy} r={3} fill={fill} stroke={fill} />;
              }}
              connectNulls={false}
            />
            <Line type="monotone" dataKey="effortScore" stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="5 4" dot={false} connectNulls={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
