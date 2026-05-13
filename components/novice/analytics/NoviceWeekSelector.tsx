"use client";

type DotState = "all" | "partial" | "none";

type Props = {
  weeks: number[];
  selectedWeek: number;
  onSelect: (week: number) => void;
  stateByWeek: Record<number, DotState>;
};

function dotColor(state: DotState): string {
  if (state === "all") return "#16a34a";
  if (state === "partial") return "#d97706";
  return "#94a3b8";
}

export default function NoviceWeekSelector({ weeks, selectedWeek, onSelect, stateByWeek }: Props) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {weeks.map((w) => {
        const selected = w === selectedWeek;
        const ds = stateByWeek[w] ?? "none";
        return (
          <button
            key={w}
            type="button"
            onClick={() => onSelect(w)}
            className="shrink-0 rounded-xl border px-3 py-2 text-sm"
            style={{
              background: selected ? "#ecfdf5" : "#fff",
              borderColor: selected ? "#2d6a4f" : "rgba(0,0,0,0.1)",
              color: "#334155",
            }}
          >
            <span>Week {w}</span>
            <span className="ml-2 align-middle">●</span>
            <span className="sr-only">{ds}</span>
            <span className="inline-block ml-1 h-2 w-2 rounded-full" style={{ background: dotColor(ds) }} aria-hidden />
          </button>
        );
      })}
    </div>
  );
}
