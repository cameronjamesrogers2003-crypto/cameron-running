"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { RunTypePill } from "@/components/RunTypePill";
import TodayLabel, { type SessionDayLabelVariant } from "./TodayLabel";
import type { WorkoutStructure } from "@/lib/workoutStructure";
import type { RunType } from "@/data/trainingPlan";

// ── Props ─────────────────────────────────────────────────────────────────────

export interface SessionCardProps {
  sessionType: RunType;
  dayLabel: string;
  description: string;
  targetKm: number;
  targetPaceStr: string;
  effortLabel: string;

  cardBg: string;
  leftBorder: string;
  colorBarBg: string;

  showRating: boolean;
  ratingNum: number | null;
  ratingBadgeStyle: { background: string; color: string } | null;
  zoneBadge: { label: string; color: string } | null;
  actualKm?: number;
  actualPaceStr?: string;

  runTypeMismatch: boolean;
  mismatchNote?: string;

  sessionLabelVariant: SessionDayLabelVariant | null;
  workoutStructure: WorkoutStructure;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function SessionCard({
  sessionType,
  dayLabel,
  description,
  targetKm,
  targetPaceStr,
  effortLabel,
  cardBg,
  leftBorder,
  colorBarBg,
  showRating,
  ratingNum,
  ratingBadgeStyle,
  zoneBadge,
  actualKm,
  actualPaceStr,
  runTypeMismatch,
  mismatchNote,
  sessionLabelVariant,
  workoutStructure,
}: SessionCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [everExpanded, setEverExpanded] = useState(false);

  function toggle() {
    if (!everExpanded) setEverExpanded(true);
    setIsExpanded((prev) => !prev);
  }

  return (
    <div
      className="rounded-2xl overflow-hidden border border-white/[0.08] w-full sm:min-w-[240px] sm:shrink-0 sm:flex-1"
      style={{ background: cardBg, borderLeft: leftBorder }}
    >
      {/* Run-type colour bar */}
      <div style={{ height: "3px", background: colorBarBg, width: "100%", flexShrink: 0 }} />

      <div className="p-4">
        {/* Day · Rating · Zone row */}
        <div className="flex items-start justify-between gap-1 mb-1.5">
          <span
            className="text-xs font-semibold uppercase tracking-wider"
            style={{ color: "var(--text-muted)" }}
          >
            {dayLabel}
          </span>
          <div className="flex flex-col items-end gap-0.5 shrink-0">
            {ratingNum != null && ratingBadgeStyle && (
              <span
                className="text-xs font-bold px-1.5 py-0.5 rounded"
                style={ratingBadgeStyle}
              >
                {ratingNum.toFixed(1)}
              </span>
            )}
            {zoneBadge && (
              <span
                className="text-xs font-medium px-1.5 py-0.5 rounded"
                style={{ color: zoneBadge.color, background: `${zoneBadge.color}22` }}
              >
                {zoneBadge.label}
              </span>
            )}
          </div>
        </div>

        {/* Run type pill */}
        <RunTypePill type={sessionType} size="sm" />

        {/* Mismatch */}
        {runTypeMismatch && mismatchNote && (
          <p
            className="text-xs mt-1.5 leading-snug rounded px-1.5 py-1"
            style={{ background: "rgba(245,158,11,0.14)", color: "#fbbf24" }}
          >
            {mismatchNote}
          </p>
        )}

        {/* Effort label */}
        <p className="text-xs mt-0.5 mb-1.5" style={{ color: "rgba(232,230,224,0.35)" }}>
          {effortLabel}
        </p>

        {/* Description */}
        <p className="text-sm font-semibold text-white mb-0.5 leading-snug">{description}</p>

        {/* Target */}
        <p className="font-mono font-semibold text-sm whitespace-nowrap text-white">
          {targetKm.toFixed(1)} km · {targetPaceStr}
        </p>

        {/* Actual (completed) */}
        {showRating && actualKm != null && actualPaceStr && (
          <p className="text-xs mt-0.5 font-mono" style={{ color: "rgba(232,230,224,0.4)" }}>
            {actualKm.toFixed(1)} km · {actualPaceStr}
          </p>
        )}

        {/* Today / Start Day / Missed label */}
        <TodayLabel variant={sessionLabelVariant} />

        {/* Expand toggle */}
        <button
          type="button"
          onClick={toggle}
          className="w-full mt-3 pt-2.5 border-t border-white/[0.06] flex items-center justify-between text-xs transition-opacity hover:opacity-80"
          style={{ color: "rgba(232,230,224,0.28)" }}
          aria-expanded={isExpanded}
          aria-label={isExpanded ? "Hide workout details" : "Show workout details"}
        >
          <span className="font-medium">{isExpanded ? "Hide details" : "Workout details"}</span>
          <ChevronDown
            className="w-3.5 h-3.5 transition-transform duration-200"
            style={{ transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)" }}
          />
        </button>

        {/* Expandable section — grid-row trick for smooth height animation */}
        <div
          className="grid transition-all duration-300 ease-in-out"
          style={{ gridTemplateRows: isExpanded ? "1fr" : "0fr" }}
        >
          <div className="min-h-0 overflow-hidden">
            {everExpanded && <WorkoutDetails structure={workoutStructure} />}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Expanded detail renderer ───────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="mb-1"
      style={{
        color: "rgba(232,230,224,0.35)",
        fontSize: "0.6875rem",
        fontWeight: 600,
        textTransform: "uppercase",
        letterSpacing: "0.07em",
      }}
    >
      {children}
    </p>
  );
}

function WorkoutDetails({ structure }: { structure: WorkoutStructure }) {
  return (
    <div className="mt-4 pt-4 border-t border-white/[0.06] space-y-4">

      {/* Purpose */}
      <div>
        <SectionLabel>Purpose</SectionLabel>
        <p className="text-xs leading-relaxed" style={{ color: "rgba(232,230,224,0.72)" }}>
          {structure.sessionPurpose}
        </p>
      </div>

      {/* Physiological target — subtle muted box */}
      <div
        className="rounded-lg px-3 py-2.5"
        style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)" }}
      >
        <p className="text-xs leading-relaxed" style={{ color: "rgba(232,230,224,0.42)" }}>
          {structure.physiologicalTarget}
        </p>
      </div>

      {/* Workout structure: Warmup / Main / Cooldown */}
      <div className="space-y-2.5">
        {[structure.warmup, structure.mainSet, structure.cooldown].map((section) => (
          <div key={section.label} className="flex gap-3">
            <div
              className="w-[52px] shrink-0 text-right pt-0.5"
              style={{
                color: "rgba(232,230,224,0.28)",
                fontSize: "0.6875rem",
                fontWeight: 600,
                textTransform: "uppercase" as const,
                letterSpacing: "0.06em",
              }}
            >
              {section.label}
            </div>
            <p
              className="flex-1 min-w-0 text-xs leading-relaxed"
              style={{ color: "rgba(232,230,224,0.8)" }}
            >
              {section.content}
            </p>
          </div>
        ))}
      </div>

      {/* Effort guidance — accent chip */}
      <div
        className="rounded-lg px-3 py-2"
        style={{
          background: "rgba(45,212,191,0.055)",
          border: "1px solid rgba(45,212,191,0.14)",
        }}
      >
        <p className="text-xs font-medium" style={{ color: "rgba(45,212,191,0.88)" }}>
          {structure.effortGuidance}
        </p>
      </div>

      {/* Execution tips */}
      {structure.executionTips.length > 0 && (
        <div>
          <SectionLabel>Tips</SectionLabel>
          <ul className="space-y-1.5 mt-1">
            {structure.executionTips.map((tip, i) => (
              <li
                key={i}
                className="flex gap-2 text-xs leading-relaxed"
                style={{ color: "rgba(232,230,224,0.65)" }}
              >
                <span className="shrink-0 mt-px" style={{ color: "var(--accent)" }}>›</span>
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Fueling (long runs) */}
      {structure.fuelingNotes && (
        <div>
          <SectionLabel>Fueling</SectionLabel>
          <p className="text-xs leading-relaxed" style={{ color: "rgba(232,230,224,0.65)" }}>
            {structure.fuelingNotes}
          </p>
        </div>
      )}

      {/* Fallback / If struggling */}
      {structure.fallbackOption && (
        <div
          className="rounded-lg px-3 py-2.5"
          style={{
            background: "rgba(245,180,84,0.055)",
            border: "1px solid rgba(245,180,84,0.14)",
          }}
        >
          <p
            className="text-xs font-semibold mb-1"
            style={{ color: "#f5b454" }}
          >
            If struggling
          </p>
          <p className="text-xs leading-relaxed" style={{ color: "rgba(245,180,84,0.82)" }}>
            {structure.fallbackOption}
          </p>
        </div>
      )}

      {/* Post-run recovery */}
      {structure.postRunRecovery && (
        <div className="pb-1">
          <SectionLabel>After</SectionLabel>
          <p className="text-xs leading-relaxed" style={{ color: "rgba(232,230,224,0.55)" }}>
            {structure.postRunRecovery}
          </p>
        </div>
      )}
    </div>
  );
}
