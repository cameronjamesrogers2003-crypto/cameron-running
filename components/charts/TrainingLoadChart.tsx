"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface LoadData {
  week: string;
  easy: number;
  tempo: number;
  interval: number;
  long: number;
}

const TOOLTIP_STYLE = {
  background: "#181818",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 8,
  fontSize: 12,
};

export default function TrainingLoadChart({ data }: { data: LoadData[] }) {
  return (
    <ResponsiveContainer width="100%" height={140}>
      <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
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
          formatter={(value, name) => [`${value} km`, name]}
        />
        <Legend
          wrapperStyle={{ fontSize: 11, color: "#9ca3af", paddingTop: 8 }}
          iconSize={8}
          iconType="circle"
        />
        <Bar dataKey="easy"     stackId="a" fill="#7c3aed" name="Easy"     />
        <Bar dataKey="tempo"    stackId="a" fill="#0d9488" name="Tempo"    />
        <Bar dataKey="interval" stackId="a" fill="#f97316" name="Interval" />
        <Bar dataKey="long"     stackId="a" fill="#d97706" name="Long"
          radius={[4, 4, 0, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
