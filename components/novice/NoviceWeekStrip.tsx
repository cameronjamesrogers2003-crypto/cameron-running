"use client";

import { useEffect, useMemo, useRef } from "react";
import { Check, RefreshCw, ArrowDown } from "lucide-react";

export type NoviceWeekStripProps = {
  totalWeeks: number;
  selectedWeek: number;
  currentWeek: number;
  onSelectWeek: (w: number) => void;
  weekMeta: Record<number, { repeated?: boolean; reduced?: boolean }>;
  evaluatedWeeks: Set<number>;
};

export function NoviceWeekStrip({
  totalWeeks,
  selectedWeek,
  currentWeek,
  onSelectWeek,
  weekMeta,
  evaluatedWeeks,
}: NoviceWeekStripProps) {
  const pillRefs = useRef<Map<number, HTMLButtonElement>>(new Map());

  useEffect(() => {
    const el = pillRefs.current.get(currentWeek);
    el?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [currentWeek]);

  const weeks = useMemo(() => Array.from({ length: totalWeeks }, (_, i) => i + 1), [totalWeeks]);

  return (
    <div
      className="flex gap-2 overflow-x-auto pb-2 pt-1 -mx-1 px-1"
      style={{ WebkitOverflowScrolling: "touch" }}
    >
      {weeks.map((w) => {
        const meta = weekMeta[w] ?? {};
        const selected = w === selectedWeek;
        const isPast = w < currentWeek;
        const isDone = isPast && evaluatedWeeks.has(w);
        const isCurrent = w === currentWeek;
        const isPastPending = isPast && !isDone;

        let bg = "#e2e8f0";
        let border = "transparent";
        let scale = "scale(1)";
        if (isCurrent) {
          bg = "#fff";
          border = "#2d6a4f";
          scale = "scale(1.12)";
        } else if (isDone) {
          bg = "#22c55e";
        } else if (isPastPending) {
          bg = "#cbd5e1";
        }

        return (
          <div key={w} className="flex flex-col items-center gap-1 shrink-0">
            <button
              type="button"
              ref={(el) => {
                if (el) pillRefs.current.set(w, el);
                else pillRefs.current.delete(w);
              }}
              onClick={() => onSelectWeek(w)}
              aria-current={selected ? "true" : undefined}
              aria-label={`Week ${w}`}
              className="relative flex h-9 w-9 items-center justify-center rounded-full border-2 transition-transform duration-200"
              style={{
                background: bg,
                borderColor: border,
                transform: isCurrent ? scale : "scale(1)",
                boxShadow: selected ? "0 0 0 2px rgba(45,106,79,0.25)" : undefined,
              }}
            >
              {isDone ? (
                <Check className="w-4 h-4 text-white" strokeWidth={2.5} />
              ) : (
                <span className={`text-xs font-semibold ${isCurrent ? "text-[#1e293b]" : "text-[#64748b]"}`}>{w}</span>
              )}
              {meta.repeated ? (
                <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#5b8fd4] text-white">
                  <RefreshCw className="w-2.5 h-2.5" />
                </span>
              ) : null}
              {meta.reduced && !meta.repeated ? (
                <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#d97706] text-white">
                  <ArrowDown className="w-2.5 h-2.5" />
                </span>
              ) : null}
            </button>
            <span className="text-[10px] font-medium text-[#94a3b8]">W{w}</span>
          </div>
        );
      })}
    </div>
  );
}
