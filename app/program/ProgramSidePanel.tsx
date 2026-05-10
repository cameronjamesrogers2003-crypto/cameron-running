"use client";

import Link from "next/link";
import { useState } from "react";

interface Props {
  maxHR: number;
}

// ── HR zone data ──────────────────────────────────────────────────────────────

interface ZoneRow {
  zone: string;
  name: string;
  loFrac: number | null;
  hiFrac: number;
  feel: string;
  highlighted: boolean;
}

const ZONE_ROWS: ZoneRow[] = [
  { zone: "Z1", name: "Recovery", loFrac: null, hiFrac: 0.6, feel: "Effortless, fully conversational", highlighted: false },
  { zone: "Z2", name: "Aerobic", loFrac: 0.6, hiFrac: 0.75, feel: "Comfortable, easy conversation", highlighted: true },
  { zone: "Z3", name: "Tempo", loFrac: 0.75, hiFrac: 0.85, feel: "Controlled, short sentences only", highlighted: false },
  { zone: "Z4", name: "Threshold", loFrac: 0.85, hiFrac: 0.92, feel: "Hard, a few words at a time", highlighted: true },
  { zone: "Z5", name: "VO₂ Max", loFrac: 0.92, hiFrac: 1.0, feel: "Maximum, cannot speak", highlighted: true },
];

function zoneBpmCell(row: ZoneRow, maxHR: number): string {
  const hiBpm = row.hiFrac < 1 ? Math.round(maxHR * row.hiFrac) : maxHR;
  if (row.loFrac == null) {
    return `< ${hiBpm}`;
  }
  const loBpm = Math.round(maxHR * row.loFrac);
  return `${loBpm}–${hiBpm}`;
}

// ── Run structure data ────────────────────────────────────────────────────────

interface RunStructure {
  type: string;
  color: string;
  body: string;
}

const RUN_STRUCTURE: RunStructure[] = [
  {
    type: "Easy",
    color: "#a5b4fc",
    body: "Stay in Zone 2 for the full session. Begin with a few minutes of easy movement to settle into effort, and wind down the same way. The goal is aerobic base-building and recovery between harder sessions — if it feels too easy, it's probably right.",
  },
  {
    type: "Long",
    color: "#d6d3d1",
    body: "Zone 2 throughout, no exceptions. Ease in gently and finish with a walk to bring HR down fully. As distance increases across your plan, the priority stays the same: controlled effort, not pace. If HR climbs in the final kilometres, slow down rather than pushing through.",
  },
  {
    type: "Tempo",
    color: "#5eead4",
    body: "Includes a warm-up and cool-down jog on either side of the main effort. The working portion targets Zone 4 — controlled discomfort that's hard but sustainable. Expect the structure and duration to vary across the plan as your threshold develops.",
  },
  {
    type: "Interval",
    color: "#fb923c",
    body: "Structured around a warm-up, a set of hard reps, and a cool-down. Each rep targets Zone 5 — close to maximum effort, not a strong cruise. Rest between reps is deliberate; don't shorten it to hit pace. Rep count, distance, and recovery will shift as the plan progresses. If a rep feels unmanageable, drop a rep rather than compromising form or cutting rest.",
  },
];

// ── Collapsible section wrapper ────────────────────────────────────────────────

function Section({
  title,
  children,
  defaultOpen = true,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="space-y-0">
      <button
        type="button"
        className="w-full min-h-11 flex items-center justify-between py-2.5 text-left"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="text-xs font-semibold uppercase tracking-wider text-white">
          {title}
        </span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          style={{
            transform: open ? "rotate(0deg)" : "rotate(-90deg)",
            transition: "transform 120ms ease",
            color: "var(--text-muted)",
          }}
        >
          <path d="M2 4L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <div
        style={{
          overflow: "hidden",
          maxHeight: open ? "2400px" : "0",
          transition: "max-height 120ms ease",
        }}
      >
        {children}
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function ProgramSidePanel({ maxHR }: Props) {
  return (
    <aside
      className="w-[252px] shrink-0 sticky overflow-y-auto"
      style={{
        top: 70,
        maxHeight: "calc(100vh - 70px)",
        borderLeft: "0.5px solid rgba(255,255,255,0.08)",
        padding: "14px",
      }}
    >
      <div className="space-y-1 divide-y" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
        {/* ── Section 1: HR Zones ──────────────────────────────────────── */}
        <Section title="Heart Rate Zones">
          <div className="pb-3 pt-0.5 space-y-2">
            <p className="text-[11px] leading-relaxed" style={{ color: "rgba(232,230,224,0.35)" }}>
              Calculated from your max HR of {maxHR} bpm. Update in{" "}
              <Link
                href="/settings"
                className="underline underline-offset-2 decoration-white/25 hover:decoration-white/50"
                style={{ color: "rgba(232,230,224,0.5)" }}
              >
                Settings
              </Link>{" "}
              if it changes.
            </p>
            <div className="rounded-md overflow-hidden border border-white/[0.05]" style={{ background: "#141414" }}>
              <table className="w-full text-left border-collapse text-[11px]">
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                    <th className="py-1.5 px-1.5 font-semibold text-white align-bottom">Zone</th>
                    <th className="py-1.5 px-1.5 font-semibold text-white align-bottom">Name</th>
                    <th
                      className="py-1.5 px-1.5 font-semibold font-mono align-bottom whitespace-nowrap"
                      style={{ color: "var(--text-muted)" }}
                    >
                      BPM
                    </th>
                    <th className="py-1.5 px-1.5 font-semibold text-white align-bottom">Feel</th>
                  </tr>
                </thead>
                <tbody>
                  {ZONE_ROWS.map((row) => (
                    <tr
                      key={row.zone}
                      style={{
                        borderBottom: "1px solid rgba(255,255,255,0.04)",
                        background: row.highlighted ? "rgba(255,255,255,0.05)" : undefined,
                      }}
                    >
                      <td
                        className="py-1.5 px-1.5 font-bold text-white align-top whitespace-nowrap"
                        style={{ opacity: row.highlighted ? 1 : 0.55 }}
                      >
                        {row.zone}
                      </td>
                      <td
                        className="py-1.5 px-1.5 text-white align-top"
                        style={{ opacity: row.highlighted ? 1 : 0.55 }}
                      >
                        {row.name}
                      </td>
                      <td
                        className="py-1.5 px-1.5 font-mono align-top whitespace-nowrap"
                        style={{ color: "var(--text-muted)", opacity: row.highlighted ? 1 : 0.85 }}
                      >
                        {zoneBpmCell(row, maxHR)}
                      </td>
                      <td
                        className="py-1.5 px-1.5 align-top leading-snug"
                        style={{ color: "rgba(232,230,224,0.5)", opacity: row.highlighted ? 1 : 0.55 }}
                      >
                        {row.feel}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Section>

        {/* ── Section 2: Run structure ──────────────────────────────────── */}
        <Section title="How to Structure Each Run">
          <div className="pb-3 space-y-2 pt-1">
            {RUN_STRUCTURE.map((rs) => (
              <div
                key={rs.type}
                className="rounded-md"
                style={{
                  background: "#141414",
                  border: "1px solid rgba(255,255,255,0.05)",
                  padding: "10px 12px",
                }}
              >
                <p className="text-xs font-semibold mb-1.5" style={{ color: rs.color }}>
                  {rs.type}
                </p>
                <p className="text-xs leading-snug" style={{ color: "rgba(232,230,224,0.55)" }}>
                  {rs.body}
                </p>
              </div>
            ))}
          </div>
        </Section>

        {/* ── Section 3: Cutback weeks ──────────────────────────────────── */}
        <Section title="What Is a Cutback Week?">
          <p
            className="text-[12px] leading-relaxed pb-3 pt-1"
            style={{ color: "rgba(232,230,224,0.55)" }}
          >
            Every 3–4 weeks the plan drops volume by ~30%. This is not optional recovery — it&apos;s when
            your body absorbs the training load and gets stronger. Skipping cutback weeks is the most
            common cause of overuse injury in beginner runners.
          </p>
        </Section>
      </div>
    </aside>
  );
}
