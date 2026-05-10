import { Moon } from "lucide-react";
import { RunTypePill } from "@/components/RunTypePill";

export type TodaySessionCardSession = {
  type: string;
  description: string;
  paceLabel: string;
  distanceLabel: string;
};

export type TodaySessionCardProps = {
  planLoaded: boolean;
  /** Row for today from the same `sessionChecklist` as the sidebar; `null` = rest day. */
  todayPlanEntry: { session: TodaySessionCardSession; completed: boolean } | null;
};

/** Run-type accent hex — matches `globals.css` `--c-*` tokens. */
function runTypeBloomRgb(type: string | undefined): { r: number; g: number; b: number } | null {
  switch (type?.toLowerCase()) {
    case "easy":
      return { r: 125, g: 211, b: 252 };
    case "tempo":
      return { r: 45, g: 212, b: 191 };
    case "interval":
      return { r: 249, g: 115, b: 22 };
    case "long":
      return { r: 167, g: 139, b: 250 };
    default:
      return null;
  }
}

export default function TodaySessionCard({ planLoaded, todayPlanEntry }: TodaySessionCardProps) {
  if (!planLoaded) return null;

  if (!todayPlanEntry) {
    return (
      <div
        className="relative w-full overflow-hidden rounded-2xl border px-5 py-3"
        style={{
          borderRadius: "var(--card-radius)",
          background: "#0a0a0a",
          borderColor: "rgba(255,255,255,0.08)",
        }}
      >
        <div className="flex items-center gap-3">
          <Moon className="w-4 h-4 shrink-0 text-zinc-500" aria-hidden />
          <p className="text-base text-zinc-300 font-medium leading-snug">
            Rest Day — recovery is part of the plan.
          </p>
        </div>
      </div>
    );
  }

  const { session } = todayPlanEntry;
  const rgb = runTypeBloomRgb(session.type);
  const borderRgb = rgb ?? { r: 156, g: 163, b: 175 };
  const bloom =
    rgb != null
      ? `radial-gradient(ellipse 60% 120% at 18% 50%, rgba(${rgb.r},${rgb.g},${rgb.b},0.14) 0%, transparent 68%)`
      : undefined;

  return (
    <div
      className="relative w-full overflow-hidden rounded-2xl border px-5 py-3"
      style={{
        borderRadius: "var(--card-radius)",
        background: "#0a0a0a",
        border: `1px solid rgba(${borderRgb.r},${borderRgb.g},${borderRgb.b},0.3)`,
      }}
    >
      {bloom != null ? (
        <div
          className="pointer-events-none absolute inset-0 z-0"
          style={{ background: bloom }}
          aria-hidden
        />
      ) : null}

      <div className="relative z-[1] flex min-w-0 items-center justify-between gap-4">
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <RunTypePill type={session.type} size="md" />
          <h2 className="text-lg font-black leading-tight tracking-tight text-white">{session.description}</h2>
        </div>
        <div className="flex shrink-0 flex-col items-end justify-center gap-0.5 text-right font-mono tabular-nums">
          <span className="text-2xl font-black text-white">{session.distanceLabel}</span>
          <span className="text-base text-zinc-400">{session.paceLabel}</span>
        </div>
      </div>
    </div>
  );
}
