"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface PaceData {
  week: string;
  paceSecKm: number | null;
}

function secKmToLabel(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const TOOLTIP_STYLE = {
  background: "#181818",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 8,
  fontSize: 12,
};

export default function AvgPaceTrendChart({ data }: { data: PaceData[] }) {
  return (
    <ResponsiveContainer width="100%" height={140}>
      <LineChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -10 }}>
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="rgba(255,255,255,0.06)"
          vertical={false}
        />
        <XAxis
          dataKey="week"
          tick={{ fill: "#9ca3af", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tickFormatter={secKmToLabel}
          tick={{ fill: "#9ca3af", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          reversed
          domain={["dataMin - 20", "dataMax + 20"]}
        />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          labelStyle={{ color: "#fff", marginBottom: 4 }}
          itemStyle={{ color: "#9ca3af" }}
          formatter={(value) => [`${secKmToLabel(value as number)} /km`, "Avg Pace"]}
          cursor={{ stroke: "rgba(255,255,255,0.1)" }}
        />
        <Line
          dataKey="paceSecKm"
          stroke="#60a5fa"
          strokeWidth={2}
          dot={{ fill: "#60a5fa", r: 3, strokeWidth: 0 }}
          activeDot={{ r: 4 }}
          connectNulls={false}
          name="Avg Pace"
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
