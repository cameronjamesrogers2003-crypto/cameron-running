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
import { useMediaQuery } from "@/lib/useMediaQuery";

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
  const compact = useMediaQuery("(max-width: 767px)");
  const tickSize = compact ? 9 : 11;
  const tipSize = compact ? 11 : 12;
  const gridColor = "rgba(255,255,255,0.06)";
  const textColor = "rgba(255,255,255,0.40)";
  const barColor = "var(--accent)";

  return (
    <div className="w-full min-w-0 -mx-1 sm:mx-0">
      <ResponsiveContainer width="100%" height={compact ? 140 : 160}>
        <ComposedChart
          data={data}
          margin={{ top: 4, right: compact ? 0 : 4, bottom: 0, left: compact ? -28 : -20 }}
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
          tick={{ fill: textColor, fontSize: tickSize, fontFamily: "var(--font-mono, monospace)" }}
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
        />
        <Bar
          dataKey="actual"
          fill={barColor}
          radius={[4, 4, 0, 0]}
          name="Actual km"
          maxBarSize={40}
          fillOpacity={1}
          shape={(props: { x?: number; y?: number; width?: number; height?: number; index?: number; payload?: WeeklyKmData }) => {
            const { x = 0, y = 0, width = 0, height = 0, index = 0, payload } = props;
            const isCurrent = index === data.length - 1;
            const actual = payload?.actual ?? 0;
            const isZero = actual <= 0;

            const displayHeight = isZero ? 2 : height;
            const displayY = isZero ? y - 2 : y;
            const isFuture = isZero && (payload?.target ?? 0) > 0;
            
            let fill = isCurrent ? "#5eead4" : barColor;
            if (isZero) fill = "#D3D1C7";
            else if (isFuture) fill = "rgba(45,212,191,0.3)";

            return (
              <g>
                {isCurrent && !isZero && (
                  <rect x={x - 1} y={displayY - 1} width={width + 2} height={displayHeight + 2} fill="rgba(45,212,191,0.16)" rx={4} />
                )}
                <rect x={x} y={displayY} width={width} height={displayHeight} fill={fill} rx={isZero ? 1 : 4} />
              </g>
            );
          }}
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
    </div>
  );
}
