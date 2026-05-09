import Link from "next/link";
import Logo from "@/components/Logo";
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
        className="relative w-full overflow-hidden rounded-2xl border px-5 py-5"
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

  const { session, completed } = todayPlanEntry;
  const rgb = runTypeBloomRgb(session.type);
  const borderRgb = rgb ?? { r: 156, g: 163, b: 175 };
  const bloom =
    rgb != null
      ? `radial-gradient(ellipse 60% 120% at 18% 50%, rgba(${rgb.r},${rgb.g},${rgb.b},0.14) 0%, transparent 68%)`
      : undefined;

  return (
    <div
      className="relative w-full min-h-[160px] max-h-[180px] overflow-hidden rounded-2xl border md:min-h-[170px]"
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

      <div
        className="pointer-events-none absolute right-0 top-1/2 z-0 w-[min(58%,320px)] -translate-y-1/2 select-none overflow-visible opacity-[0.35]"
        aria-hidden
      >
        <div className="flex translate-x-[8%] justify-end">
          <Logo size="lg" showWordmark={false} className="origin-right scale-[2.1] sm:scale-[2.35]" />
        </div>
      </div>

      <div
        className={`relative z-[1] flex h-full min-h-[160px] flex-col gap-3 p-4 md:min-h-[170px] md:flex-row md:items-center md:justify-between md:gap-6 md:p-5 ${
          !completed ? "pb-[3.25rem] md:pb-5" : ""
        }`}
      >
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <RunTypePill type={session.type} size="md" />
          <h2 className="text-2xl font-black leading-tight tracking-tight text-white">{session.description}</h2>
          <p className="text-lg font-mono tabular-nums text-white/90 md:hidden">
            {session.distanceLabel}
            <span className="mx-1.5 text-white/35" aria-hidden>
              ·
            </span>
            {session.paceLabel}
          </p>
        </div>
        <div className="hidden shrink-0 flex-col items-end gap-0.5 text-lg font-mono tabular-nums text-white/90 md:flex">
          <span>{session.distanceLabel}</span>
          <span>{session.paceLabel}</span>
        </div>

        {!completed ? (
          <Link
            href="/runs"
            className="absolute bottom-3 right-3 z-[2] rounded-xl px-4 py-2 text-sm font-bold transition-colors hover:bg-[#14b8a6] md:bottom-4 md:right-4"
            style={{
              background: "var(--accent)",
              color: "#0a0b0c",
            }}
          >
            Mark Complete
          </Link>
        ) : null}
      </div>
    </div>
  );
}
