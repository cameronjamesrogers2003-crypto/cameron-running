"use client";

type Ratio = { runSec: number; walkSec: number };

export type NoviceRunWalkIndicatorProps = {
  ratio: Ratio;
  variant: "easy" | "long";
};

const RUN_COL = { easy: "#5b8fd4", long: "#2d6a4f" };

export function NoviceRunWalkIndicator({ ratio, variant }: NoviceRunWalkIndicatorProps) {
  const { runSec, walkSec } = ratio;
  if (walkSec === 0) {
    return (
      <p className="text-sm" style={{ color: "rgba(0,0,0,0.55)" }}>
        Run continuously for this session.
      </p>
    );
  }

  const total = runSec + walkSec;
  const runPct = total > 0 ? (runSec / total) * 100 : 50;
  const runColor = RUN_COL[variant];
  const label = `${runSec} sec run · ${walkSec} sec walk · repeat`;
  const aria = `Run/walk ratio: ${runSec} seconds running, ${walkSec} seconds walking`;

  return (
    <div className="space-y-2">
      <div
        className="flex h-3 w-full max-w-[220px] overflow-hidden rounded-full bg-[#e2e8f0]"
        role="img"
        aria-label={aria}
      >
        <div className="h-full rounded-l-full transition-all duration-300" style={{ width: `${runPct}%`, background: runColor }} />
        <div className="h-full flex-1 bg-[#cbd5e1]" />
      </div>
      <p className="text-xs sm:text-sm text-[#64748b]">{label}</p>
    </div>
  );
}

export function noviceRunWalkSegments(ratio: Ratio): { runPct: number; walkPct: number } {
  const t = ratio.runSec + ratio.walkSec;
  if (ratio.walkSec === 0) return { runPct: 100, walkPct: 0 };
  if (t <= 0) return { runPct: 50, walkPct: 50 };
  return { runPct: (ratio.runSec / t) * 100, walkPct: (ratio.walkSec / t) * 100 };
}
