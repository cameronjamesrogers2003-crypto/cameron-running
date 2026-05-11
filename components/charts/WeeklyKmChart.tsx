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

export type WeekChartEntry = {
  label: string;          // e.g. "20 Apr–26 Apr"
  startDate: string;      // ISO string, Monday 00:00:00 AEST
  actualKm: number;       // sum of distanceKm for all runs in that week
  actualKmDisplay: number; // same as actualKm, but minimum 0.5 if actualKm === 0 (for bar rendering)
  targetKm: number | null; // from plan sessions if plan started, else +10% of prev actual, else null
  trajectoryKm: number;   // previous week's actualKm (or this week's actualKm for week 0)
  isPlanWeek: boolean;    // true if weekStart >= planStartDate (AEST comparison)
};

function getBarColour(index: number, data: WeekChartEntry[]): string {
  const isCurrentWeek = index === data.length - 1;
  if (isCurrentWeek) return "#FFFFFF";

  if (index === 0) return "#991B1B";

  const current = data[index].actualKm;
  const previous = data[index - 1].actualKm;
  return current >= previous ? "#991B1B" : "#38BDF8";
}

function CustomTooltip({ active, payload, label, chartData }: any) {
  if (!active || !payload?.length) return null;
  const entry: WeekChartEntry = payload[0]?.payload;
  const isCurrentWeek = entry.label === chartData[chartData.length - 1]?.label;

  return (
    <div style={{
      background: "#1a1a1a",
      border: "0.5px solid #374151",
      borderRadius: 8,
      padding: "10px 14px",
      fontSize: 13,
      color: "#f9fafb",
      minWidth: 200,
    }}>
      <p style={{ fontWeight: 500, marginBottom: 6 }}>{label}</p>
      <p style={{ color: "#9ca3af", margin: "2px 0" }}>
        Actual km: {entry.actualKm.toFixed(1)}
      </p>
      {entry.targetKm !== null && (
        <p style={{ color: "#9ca3af", margin: "2px 0" }}>
          {entry.isPlanWeek
            ? `Target km (plan): ${entry.targetKm.toFixed(1)}`
            : `Target km (suggested +10%): ${entry.targetKm.toFixed(1)}`}
        </p>
      )}
      {isCurrentWeek && (
        <p style={{ color: "#22D3EE", margin: "6px 0 0", fontSize: 11, fontWeight: 500 }}>
          ● current week in progress
        </p>
      )}
    </div>
  );
}

export default function WeeklyKmChart({ data }: { data: WeekChartEntry[] }) {
  const compact = useMediaQuery("(max-width: 767px)");
  const gridColor = "rgba(255,255,255,0.06)";
  const textColor = "rgba(255,255,255,0.40)";

  return (
    <div className="w-full min-w-0 -mx-1 sm:mx-0">
      <ResponsiveContainer width="100%" height={compact ? 140 : 160}>
        <ComposedChart
          data={data}
          margin={{ top: 10, right: 16, left: 0, bottom: 0 }}
          barCategoryGap="30%"
          barGap={4}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke={gridColor}
            vertical={false}
          />
          <XAxis 
            dataKey="label" 
            tick={{ fill: textColor, fontSize: 11 }} 
            axisLine={false}
            tickLine={false}
          />
          
          <YAxis
            tickCount={5}
            tick={{ fill: textColor, fontSize: 11, fontFamily: "var(--font-mono, monospace)" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(value: number) => `${value}km`}
            domain={[0, (dataMax: number) => Math.ceil((dataMax + 2) / 5) * 5]}
            width={48}
            allowDecimals={false}
          />

          <Tooltip content={<CustomTooltip chartData={data} />} />

          <Bar
            dataKey="actualKmDisplay"
            radius={[4, 4, 0, 0]}
            maxBarSize={72}
          >
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={getBarColour(index, data)}
                stroke={index === data.length - 1 ? "#22D3EE" : "none"}
                strokeWidth={index === data.length - 1 ? 2 : 0}
              />
            ))}
          </Bar>

          <Line
            dataKey="trajectoryKm"
            stroke="#6B7280"
            strokeDasharray="5 4"
            strokeWidth={1.5}
            dot={false}
            connectNulls={false}
            type="monotone"
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

