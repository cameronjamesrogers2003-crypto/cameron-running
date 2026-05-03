"use client";

import { useState } from "react";
import { format } from "date-fns";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface WeightEntry {
  id: number;
  weightKg: number;
  loggedAt: Date;
}

export default function WeightTracker({ entries }: { entries: WeightEntry[] }) {
  const [input, setInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    const val = parseFloat(input);
    if (!val || val < 30 || val > 200) {
      setError("Enter a valid weight (30–200 kg)");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/profile/weight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weightKg: val }),
      });
      if (res.ok) {
        setInput("");
        window.location.reload();
      } else {
        setError("Failed to save");
      }
    } finally {
      setSaving(false);
    }
  }

  const chartData = [...entries]
    .reverse()
    .slice(-20)
    .map((e) => ({
      date: format(new Date(e.loggedAt), "d MMM"),
      weight: e.weightKg,
    }));

  return (
    <div
      className="rounded-xl p-5"
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
    >
      <h3 className="text-sm font-semibold uppercase tracking-wider mb-4" style={{ color: "var(--text-muted)" }}>
        Weight Tracker
      </h3>

      <div className="flex gap-2 mb-4">
        <input
          type="number"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="e.g. 68.5"
          className="flex-1 rounded-lg px-3 py-2 text-sm text-white outline-none focus:ring-1"
          style={{
            background: "var(--surface-2)",
            border: "1px solid var(--border)",
            borderRadius: 8,
          }}
          onKeyDown={(e) => e.key === "Enter" && handleSave()}
        />
        <span className="flex items-center text-sm" style={{ color: "var(--text-muted)" }}>kg</span>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50 text-white"
          style={{ background: "var(--accent)" }}
        >
          Log
        </button>
      </div>

      {error && <p className="text-red-400 text-xs mb-2">{error}</p>}

      {chartData.length > 1 && (
        <ResponsiveContainer width="100%" height={100}>
          <LineChart data={chartData}>
            <XAxis dataKey="date" tick={{ fill: "#6b7280", fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis domain={["auto", "auto"]} tick={{ fill: "#6b7280", fontSize: 10 }} axisLine={false} tickLine={false} width={32} />
            <Tooltip
              contentStyle={{
                background: "var(--surface-2)",
                border: "1px solid var(--border)",
                color: "var(--text)",
                fontSize: 12,
              }}
              formatter={(v) => [`${v} kg`, "Weight"]}
            />
            <Line type="monotone" dataKey="weight" stroke="#f97316" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      )}

      {entries.length > 0 && (
        <div className="mt-3 flex justify-between text-xs" style={{ color: "var(--text-muted)" }}>
          <span>Latest: <span className="text-white font-semibold">{entries[0].weightKg} kg</span></span>
          <span>{format(new Date(entries[0].loggedAt), "d MMM yyyy")}</span>
        </div>
      )}
    </div>
  );
}
