"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

interface WeekData {
  week: number;
  km: number;
  current: boolean;
  phase: "base" | "build" | "peak" | "taper";
}

interface WeeklyChartProps {
  data: WeekData[];
}

const PHASE_COLOUR: Record<string, string> = {
  base: "#3b82f6",
  build: "#f97316",
  peak: "#ef4444",
  taper: "#10b981",
};

interface TooltipPayload {
  value: number;
  payload: WeekData;
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayload[] }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div
      className="rounded-lg px-3 py-2 text-sm shadow-lg"
      style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text)" }}
    >
      <p className="font-semibold">Week {d.week}</p>
      <p style={{ color: "var(--accent)" }}>{d.km.toFixed(1)} km</p>
      <p className="capitalize text-xs" style={{ color: "var(--text-muted)" }}>{d.phase}</p>
    </div>
  );
}

export default function WeeklyChart({ data }: WeeklyChartProps) {
  return (
    <div
      className="rounded-xl p-4"
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
    >
      <h2 className="text-sm font-semibold uppercase tracking-wider mb-4" style={{ color: "var(--text-muted)" }}>
        Weekly Mileage
      </h2>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={data} barCategoryGap="30%">
          <XAxis
            dataKey="week"
            tick={{ fill: "#6b7280", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `W${v}`}
          />
          <YAxis
            tick={{ fill: "#6b7280", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `${v}`}
            width={30}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
          <Bar dataKey="km" radius={[4, 4, 0, 0]}>
            {data.map((entry, idx) => (
              <Cell
                key={idx}
                fill={entry.current ? "#f97316" : PHASE_COLOUR[entry.phase]}
                opacity={entry.current ? 1 : 0.55}
                stroke={entry.current ? "#f97316" : "none"}
                strokeWidth={entry.current ? 1 : 0}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="flex flex-wrap gap-3 mt-2">
        {Object.entries(PHASE_COLOUR).map(([phase, colour]) => (
          <div key={phase} className="flex items-center gap-1.5 text-xs capitalize" style={{ color: "var(--text-muted)" }}>
            <div className="w-2.5 h-2.5 rounded-sm" style={{ background: colour }} />
            {phase}
          </div>
        ))}
        <div className="flex items-center gap-1.5 text-xs" style={{ color: "var(--text-muted)" }}>
          <div className="w-2.5 h-2.5 rounded-sm" style={{ background: "#f97316" }} />
          Current week
        </div>
      </div>
    </div>
  );
}
