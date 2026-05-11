"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { RunTypePill } from "@/components/RunTypePill";
import TodayLabel, { type SessionDayLabelVariant } from "./TodayLabel";
import WorkoutModal from "./WorkoutModal";
import type { WorkoutStructure } from "@/lib/workoutStructure";
import type { RunType } from "@/data/trainingPlan";

// ── Props ─────────────────────────────────────────────────────────────────────

export interface SessionCardProps {
  sessionType: RunType;
  dayLabel: string;
  sessionDateStr: string;
  weekNumber: number;
  phase: string;
  description: string;
  targetKm: number;
  targetPaceStr: string;
  effortLabel: string;
  isNovice?: boolean;

  cardBg: string;
  leftBorder: string;
  colorBarBg: string;

  showRating: boolean;
  ratingNum: number | null;
  ratingBadgeStyle: { background: string; color: string } | null;
  zoneBadge: { label: string; color: string } | null;
  actualKm?: number;
  actualPaceStr?: string;
  isCompleted: boolean;

  runTypeMismatch: boolean;
  mismatchNote?: string;

  sessionLabelVariant: SessionDayLabelVariant | null;
  workoutStructure: WorkoutStructure;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function SessionCard(props: SessionCardProps) {
  const {
    sessionType,
    dayLabel,
    description,
    targetKm,
    targetPaceStr,
    effortLabel,
    isNovice,
    cardBg,
    leftBorder,
    colorBarBg,
    showRating,
    ratingNum,
    ratingBadgeStyle,
    zoneBadge,
    actualKm,
    actualPaceStr,
    isCompleted,
    runTypeMismatch,
    sessionLabelVariant,
  } = props;

  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* ── Compact session card ──────────────────────────────────────── */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => setIsOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setIsOpen(true);
          }
        }}
        className="rounded-2xl overflow-hidden border border-white/[0.08] w-full sm:min-w-[220px] sm:shrink-0 sm:flex-1 cursor-pointer select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50"
        style={{
          background: cardBg,
          borderLeft: leftBorder,
          transition: "border-color 0.15s ease, filter 0.15s ease",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLDivElement).style.filter = "brightness(1.08)";
          (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(255,255,255,0.14)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLDivElement).style.filter = "";
          (e.currentTarget as HTMLDivElement).style.borderColor = "";
        }}
      >
        {/* Run-type colour bar */}
        <div style={{ height: "3px", background: colorBarBg, width: "100%", flexShrink: 0 }} />

        <div className="p-3.5">
          {/* Day · badges row */}
          <div className="flex items-start justify-between gap-1 mb-2">
            <div className="flex items-center gap-1.5">
              <span
                className="text-xs font-semibold uppercase tracking-wider"
                style={{ color: "var(--text-muted)" }}
              >
                {dayLabel}
              </span>
              {isCompleted && (
                <span className="flex items-center justify-center w-3.5 h-3.5 rounded-full bg-emerald-500/20 text-emerald-500">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" className="w-2 h-2">
                    <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
              )}
            </div>
            <div className="flex items-center gap-1 flex-wrap justify-end shrink-0">
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

          {/* Effort label */}
          <p
            className="text-xs mt-1 mb-1.5"
            style={{ color: "rgba(232,230,224,0.32)" }}
          >
            {effortLabel}
          </p>

          {/* Description — capped at 2 lines */}
          <p
            className="text-sm font-semibold text-white mb-1 leading-snug"
            style={{
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {description}
          </p>

          {/* Target */}
          <p className="font-mono font-semibold text-sm text-white">
            {targetKm.toFixed(1)} km {isNovice ? "" : `· ${targetPaceStr}`}
          </p>

          {isNovice && (
            <span className="inline-block mt-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold bg-teal-500/20 text-teal-400 border border-teal-500/30 uppercase tracking-tighter">
              Target RPE: 3-4
            </span>
          )}

          {/* Actual (completed) */}
          {showRating && actualKm != null && actualPaceStr && (
            <p
              className="text-xs mt-0.5 font-mono"
              style={{ color: "rgba(45,212,191,0.72)" }}
            >
              ✓ {actualKm.toFixed(1)} km · {actualPaceStr}
            </p>
          )}

          {/* Mismatch indicator */}
          {runTypeMismatch && (
            <p className="text-xs mt-1" style={{ color: "#fbbf24" }}>
              ⚠ Type mismatch
            </p>
          )}

          {/* Today / Start Day / Missed label */}
          <TodayLabel variant={sessionLabelVariant} />

          {/* Details affordance */}
          <div
            className="flex items-center justify-between mt-3 pt-2.5"
            style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}
          >
            <span
              className="text-[10px] font-semibold uppercase tracking-widest"
              style={{ color: "rgba(232,230,224,0.18)", letterSpacing: "0.09em" }}
            >
              Details
            </span>
            <ChevronRight
              className="w-3 h-3"
              style={{ color: "rgba(232,230,224,0.18)" }}
            />
          </div>
        </div>
      </div>

      {/* ── Detail modal (portal) ──────────────────────────────────── */}
      {isOpen && <WorkoutModal {...props} onClose={() => setIsOpen(false)} />}
    </>
  );
}
