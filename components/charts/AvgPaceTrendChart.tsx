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
import { useMediaQuery } from "@/lib/useMediaQuery";
import { useTheme } from "@/context/ThemeContext";

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
  const { theme } = useTheme();
  const compact = useMediaQuery("(max-width: 767px)");
  const tickSize = compact ? 9 : 11;
  const tipSize = compact ? 11 : 12;
  const gridColor = theme === "light" ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.06)";
  const textColor = theme === "light" ? "rgba(0,0,0,0.45)" : "rgba(255,255,255,0.40)";
  const barColor = theme === "light" ? "#0d9488" : "var(--accent)";

  return (
    <div className="w-full min-w-0 -mx-1 sm:mx-0">
      <ResponsiveContainer width="100%" height={compact ? 120 : 140}>
        <LineChart
          data={data}
          margin={{ top: 4, right: compact ? 0 : 4, bottom: 0, left: compact ? -6 : -10 }}
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
          tickFormatter={secKmToLabel}
          tick={{ fill: textColor, fontSize: tickSize }}
          axisLine={false}
          tickLine={false}
          width={compact ? 40 : 52}
          reversed
          domain={["dataMin - 20", "dataMax + 20"]}
        />
        <Tooltip
          contentStyle={{ ...TOOLTIP_STYLE, fontSize: tipSize }}
          labelStyle={{ color: "#fff", marginBottom: 4, fontSize: tipSize }}
          itemStyle={{ color: textColor, fontSize: tipSize }}
          formatter={(value) => [`${secKmToLabel(value as number)} /km`, "Avg Pace"]}
          cursor={{ stroke: "rgba(255,255,255,0.1)" }}
        />
        <Line
          dataKey="paceSecKm"
          stroke={barColor}
          strokeWidth={2}
          dot={{ fill: barColor, r: 3, strokeWidth: 0 }}
          activeDot={{ r: 4 }}
          connectNulls={false}
          name="Avg Pace"
        />
      </LineChart>
    </ResponsiveContainer>
    </div>
  );
}
