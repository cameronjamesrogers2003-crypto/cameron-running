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
  Cell,
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

function getBarColour(index: number, data: WeeklyKmData[]): string {
  const isCurrentWeek = index === data.length - 1;
  if (isCurrentWeek) return "#FFFFFF";

  const actual = data[index].actual;
  const previous = data[index - 1]?.actual ?? 0;

  if (index === 0) return "#991B1B"; // Default for first week
  return actual >= previous ? "#991B1B" : "#38BDF8";
}

function CustomTooltip({ active, payload, label, data }: any) {
  if (!active || !payload || !payload.length) return null;

  const actual = payload[0].value;
  const target = payload[1]?.value ?? 0;
  const index = data.findIndex((d: any) => d.week === label);
  const isCurrent = index === data.length - 1;
  const previous = index > 0 ? data[index - 1].actual : 0;

  let statusLine = "";
  let statusColor = "";

  if (isCurrent) {
    statusLine = "⬤ current week in progress";
    statusColor = "#FFFFFF";
  } else if (actual >= previous) {
    statusLine = "↑ volume up from last week";
    statusColor = "#991B1B";
  } else {
    statusLine = "↓ volume down — recovery";
    statusColor = "#38BDF8";
  }

  return (
    <div style={TOOLTIP_STYLE} className="p-2.5 space-y-1">
      <p className="text-white font-bold mb-1">{label}</p>
      <p style={{ color: "rgba(255,255,255,0.7)" }}>
        Actual km: <span className="text-white">{actual.toFixed(1)}</span>
      </p>
      <p style={{ color: "rgba(255,255,255,0.7)" }}>
        Target km: <span className="text-white">{target.toFixed(1)}</span>
      </p>
      <p className="pt-1 mt-1 border-t border-white/10 text-[10px] font-bold uppercase tracking-wider" style={{ color: statusColor }}>
        {statusLine}
      </p>
    </div>
  );
}

export default function WeeklyKmChart({ data }: { data: WeeklyKmData[] }) {
  const compact = useMediaQuery("(max-width: 767px)");
  const tickSize = compact ? 9 : 11;
  const tipSize = compact ? 11 : 12;
  const gridColor = "rgba(255,255,255,0.06)";
  const textColor = "rgba(255,255,255,0.40)";

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
          width={48}
          tickCount={6}
          tickFormatter={(value: number) => `${Math.round(value / 5) * 5}km`}
          domain={[0, "auto"]}
        />
        <Tooltip
          content={<CustomTooltip data={data} />}
          cursor={{ fill: "rgba(255,255,255,0.04)" }}
        />
        <Bar
          dataKey="actual"
          radius={[4, 4, 0, 0]}
          name="Actual km"
          maxBarSize={40}
          fillOpacity={1}
        >
          {data.map((entry, index) => {
            const isCurrent = index === data.length - 1;
            const actual = entry.actual;
            const isZero = actual <= 0;
            const fill = getBarColour(index, data);

            return (
              <Cell
                key={`cell-${index}`}
                fill={isZero ? "#D3D1C7" : fill}
                stroke={isCurrent ? "#22D3EE" : "none"}
                strokeWidth={isCurrent ? 2 : 0}
                style={{
                  // Custom shape handling for zero-height bars moved here if possible, 
                  // or we can use a custom shape prop on Bar and just use Cell for colors.
                  // Recharts Bar Cell only handles colors well.
                }}
              />
            );
          })}
        </Bar>
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
