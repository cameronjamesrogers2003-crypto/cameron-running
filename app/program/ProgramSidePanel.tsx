"use client";

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
  { zone: "Z1", name: "Recovery",  loFrac: null, hiFrac: 0.60, feel: "Effortless, fully conversational",  highlighted: false },
  { zone: "Z2", name: "Aerobic",   loFrac: 0.60, hiFrac: 0.75, feel: "Comfortable, easy conversation",    highlighted: true  },
  { zone: "Z3", name: "Tempo",     loFrac: 0.75, hiFrac: 0.85, feel: "Controlled, short sentences only",  highlighted: false },
  { zone: "Z4", name: "Threshold", loFrac: 0.85, hiFrac: 0.92, feel: "Hard, a few words at a time",       highlighted: true  },
  { zone: "Z5", name: "VO₂ Max",   loFrac: 0.92, hiFrac: 1.00, feel: "Maximum, cannot speak",             highlighted: true  },
];

// ── Run structure data ────────────────────────────────────────────────────────

interface RunStructure {
  type: string;
  color: string;
  items: string[];
  note: string | null;
}

const RUN_STRUCTURE: RunStructure[] = [
  {
    type: "Easy",
    color: "#a5b4fc",
    items: [
      "Warm up: 5 min walk or very easy jog",
      "Main: full distance at Zone 2 effort",
      "Cool down: 5 min walk",
      "Goal: build aerobic base, recover between hard sessions",
    ],
    note: null,
  },
  {
    type: "Long",
    color: "#d6d3d1",
    items: [
      "Warm up: 5 min easy jog",
      "Main: full distance at Zone 2 effort — never push the pace",
      "Cool down: 5–10 min walk + stretch",
      "Goal: build endurance and fat adaptation",
    ],
    note: "If your HR drifts above Zone 2 in the final km, slow down — don't push through it.",
  },
  {
    type: "Tempo",
    color: "#5eead4",
    items: [
      "Warm up: 1.5 km easy jog",
      "Main: prescribed duration at Zone 4 effort — controlled discomfort",
      "Cool down: 1 km easy jog",
      "Goal: raise lactate threshold",
    ],
    note: "Tempo pace should feel like a 7/10 effort — hard but sustainable for 20–45 min.",
  },
  {
    type: "Interval",
    color: "#fb923c",
    items: [
      "Warm up: 1.5 km easy jog",
      "Main: prescribed reps at Zone 5 effort with 90 sec standing rest between reps",
      "Cool down: 1 km easy jog",
      "Goal: build VO₂ max and running economy",
    ],
    note: "Each rep should feel like 9/10 effort. If rep 4 feels easier than rep 1, you went too easy.",
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
        onClick={() => setOpen(o => !o)}
      >
        <span className="text-xs font-semibold uppercase tracking-wider text-white">
          {title}
        </span>
        <svg
          width="12" height="12" viewBox="0 0 12 12" fill="none"
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
          <div className="pb-3 space-y-1">
            {ZONE_ROWS.map((row) => {
              const loBpm = row.loFrac != null ? Math.round(maxHR * row.loFrac) : null;
              const hiBpm = row.hiFrac < 1.00 ? Math.round(maxHR * row.hiFrac) : maxHR;
              const bpmRange = loBpm == null ? `< ${hiBpm} bpm` : `${loBpm}–${hiBpm} bpm`;

              return (
                <div
                  key={row.zone}
                  className="rounded px-2 py-1.5"
                  style={{
                    background: row.highlighted ? "rgba(255,255,255,0.05)" : "#141414",
                    opacity: row.highlighted ? 1 : 0.55,
                  }}
                >
                  <div className="flex items-center justify-between gap-1 mb-0.5">
                    <span className="text-[11px] font-bold text-white">{row.zone} {row.name}</span>
                    <span className="text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>
                      {bpmRange}
                    </span>
                  </div>
                  <p className="text-[11px] leading-tight" style={{ color: "rgba(232,230,224,0.5)" }}>
                    {row.feel}
                  </p>
                </div>
              );
            })}

            <p
              className="text-[11px] leading-relaxed pt-1"
              style={{ color: "rgba(232,230,224,0.35)" }}
            >
              Calculated from your max HR ({maxHR} bpm). Update in Settings if it changes.
            </p>
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
                <p className="text-[11px] font-semibold mb-1.5" style={{ color: rs.color }}>
                  {rs.type}
                </p>
                <ul className="space-y-0.5">
                  {rs.items.map((item, i) => (
                    <li key={i} className="text-[11px] leading-snug flex gap-1.5">
                      <span style={{ color: "rgba(232,230,224,0.25)" }}>·</span>
                      <span style={{ color: "rgba(232,230,224,0.55)" }}>{item}</span>
                    </li>
                  ))}
                </ul>
                {rs.note && (
                  <p
                    className="text-[11px] leading-snug mt-2 pt-2 italic"
                    style={{
                      color: "rgba(232,230,224,0.4)",
                      borderTop: "1px solid rgba(255,255,255,0.05)",
                    }}
                  >
                    {rs.note}
                  </p>
                )}
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
