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
import { useMediaQuery } from "@/lib/useMediaQuery";

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
  const compact = useMediaQuery("(max-width: 767px)");
  const tickSize = compact ? 9 : 11;
  const tipSize = compact ? 11 : 12;
  const gridColor = "rgba(255,255,255,0.06)";
  const textColor = "rgba(255,255,255,0.40)";

  return (
    <div className="w-full min-w-0 -mx-1 sm:mx-0">
      <ResponsiveContainer width="100%" height={compact ? 150 : 140}>
        <BarChart
          data={data}
          margin={{ top: 4, right: compact ? 0 : 4, bottom: compact ? 4 : 0, left: compact ? -28 : -20 }}
        >
        <CartesianGrid
          strokeDasharray="3 3"
          stroke={gridColor}
          vertical={false}
        />
        <XAxis
          dataKey="week"
          tick={{ fill: textColor, fontSize: tickSize }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: textColor, fontSize: tickSize }}
          axisLine={false}
          tickLine={false}
          width={compact ? 36 : 44}
          unit=" km"
        />
        <Tooltip
          contentStyle={{ ...TOOLTIP_STYLE, fontSize: tipSize }}
          labelStyle={{ color: "#fff", marginBottom: 4, fontSize: tipSize }}
          itemStyle={{ color: textColor, fontSize: tipSize }}
          cursor={{ fill: "rgba(255,255,255,0.04)" }}
          formatter={(value, name) => [`${value} km`, name]}
        />
        <Legend
          wrapperStyle={{
            fontSize: compact ? 9 : 11,
            color: textColor,
            paddingTop: 6,
          }}
          iconSize={compact ? 6 : 8}
          iconType="circle"
        />
        <Bar dataKey="easy"     stackId="a" fill="var(--c-easy)" name="Easy"     />
        <Bar dataKey="tempo"    stackId="a" fill="var(--c-tempo)" name="Tempo"    />
        <Bar dataKey="interval" stackId="a" fill="var(--c-interval)" name="Interval" />
        <Bar dataKey="long"     stackId="a" fill="var(--c-long)" name="Long"
          radius={[4, 4, 0, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
    </div>
  );
}
