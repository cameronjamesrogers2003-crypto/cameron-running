"use client";

import { LineChart, Line, Tooltip, ReferenceLine, ResponsiveContainer } from "recharts";

interface RatingPoint {
  date: string;
  score: number;
}

interface RatingSparklineProps {
  ratings: RatingPoint[];
  avg4wk: number | null;
  bestThisWeek: { score: number; distanceKm: number } | null;
}

export default function RatingSparkline({ ratings, avg4wk, bestThisWeek }: RatingSparklineProps) {
  if (!ratings.length) return null;

  const chartData = [...ratings].reverse();

  return (
    <div
      className="rounded-xl p-4"
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
    >
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
          Run Ratings
        </h2>
        <div className="flex items-center gap-4">
          {bestThisWeek && (
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              Best this week:{" "}
              <span className="font-bold text-white">{bestThisWeek.score.toFixed(1)}</span>
              <span className="ml-1" style={{ color: "var(--text-muted)" }}>
                ({bestThisWeek.distanceKm.toFixed(1)} km)
              </span>
            </span>
          )}
          {avg4wk !== null && (
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              4-wk avg:{" "}
              <span className="font-bold text-white">{avg4wk.toFixed(1)}</span>
            </span>
          )}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={72}>
        <LineChart data={chartData}>
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              return (
                <div
                  className="rounded px-2 py-1 text-xs"
                  style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
                >
                  <span className="font-bold text-white">{Number(payload[0].value).toFixed(1)}</span>
                </div>
              );
            }}
          />
          {avg4wk !== null && (
            <ReferenceLine y={avg4wk} stroke="#6b7280" strokeDasharray="3 3" strokeWidth={1} />
          )}
          <Line
            type="monotone"
            dataKey="score"
            stroke="#f97316"
            strokeWidth={2}
            dot={{ r: 3, fill: "#f97316", strokeWidth: 0 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
