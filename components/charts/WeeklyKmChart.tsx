"use client";

import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface WeeklyKmData {
  week: string;
  actual: number;
  target: number;
}

const TOOLTIP_STYLE = {
  background: "#181818",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 8,
  fontSize: 12,
};

export default function WeeklyKmChart({ data }: { data: WeeklyKmData[] }) {
  return (
    <ResponsiveContainer width="100%" height={160}>
      <ComposedChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
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
          tick={{ fill: "#9ca3af", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          unit=" km"
        />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          labelStyle={{ color: "#fff", marginBottom: 4 }}
          itemStyle={{ color: "#9ca3af" }}
          cursor={{ fill: "rgba(255,255,255,0.04)" }}
        />
        <Bar
          dataKey="actual"
          fill="#f97316"
          radius={[4, 4, 0, 0]}
          name="Actual km"
          maxBarSize={40}
        />
        <Line
          dataKey="target"
          stroke="rgba(255,255,255,0.3)"
          strokeWidth={1.5}
          strokeDasharray="4 4"
          dot={false}
          name="Target km"
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
