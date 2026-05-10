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
      className="w-[252px] min-w-0 shrink-0 sticky overflow-y-auto overflow-x-hidden"
      style={{
        top: 70,
        maxHeight: "calc(100vh - 70px)",
        borderLeft: "0.5px solid rgba(255,255,255,0.08)",
        padding: "14px",
      }}
    >
      <div className="space-y-1 divide-y min-w-0" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
        {/* ── Section 1: HR Zones ──────────────────────────────────────── */}
        <Section title="Heart Rate Zones">
          <div className="pb-3 pt-0.5 space-y-2 min-w-0">
            <p className="text-[11px] leading-relaxed break-words" style={{ color: "rgba(232,230,224,0.35)" }}>
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
            {/* Stacked rows: full-width Feel avoids clipping in a 252px sidebar (4-col table was too wide). */}
            <div className="rounded-md border border-white/[0.05] min-w-0" style={{ background: "#141414" }}>
              <div
                className="px-2 py-1.5 border-b border-white/[0.06] text-[10px] font-semibold uppercase tracking-wide"
                style={{ color: "rgba(232,230,224,0.85)" }}
              >
                <div className="flex justify-between gap-2 min-w-0">
                  <span className="text-white">Zone · Name</span>
                  <span className="font-mono shrink-0" style={{ color: "rgba(232,230,224,0.85)" }}>
                    BPM
                  </span>
                </div>
                <div className="mt-0.5 text-white">Feel</div>
              </div>
              <div role="list">
                {ZONE_ROWS.map((row) => (
                  <div
                    key={row.zone}
                    role="listitem"
                    className="px-2 py-1.5 border-b border-white/[0.04] last:border-b-0 min-w-0"
                    style={{
                      background: row.highlighted ? "rgba(255,255,255,0.05)" : undefined,
                    }}
                  >
                    <div className="flex justify-between items-baseline gap-2 min-w-0 text-[11px]">
                      <span
                        className="font-bold text-white min-w-0 break-words"
                        style={{ opacity: row.highlighted ? 1 : 0.55 }}
                      >
                        {row.zone} {row.name}
                      </span>
                      <span
                        className="font-mono shrink-0 tabular-nums"
                        style={{
                          color: "rgba(232,230,224,0.75)",
                          opacity: row.highlighted ? 1 : 0.85,
                        }}
                      >
                        {zoneBpmCell(row, maxHR)}
                      </span>
                    </div>
                    <p
                      className="text-[11px] leading-snug mt-1 break-words"
                      style={{ color: "rgba(232,230,224,0.5)", opacity: row.highlighted ? 1 : 0.55 }}
                    >
                      {row.feel}
                    </p>
                  </div>
                ))}
              </div>
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
