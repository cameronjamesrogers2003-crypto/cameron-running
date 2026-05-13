"use client";

type Props = {
  currentWeek: number;
  totalWeeks: number;
  totalSessionsCompleted: number;
  totalKmCovered: number;
  totalActualKmIsEstimated: boolean;
};

export default function NoviceProgressHeader(props: Props) {
  const pct = Math.max(0, Math.min(100, (props.currentWeek / Math.max(1, props.totalWeeks)) * 100));

  return (
    <section className="rounded-2xl bg-[#faf8f5] border border-black/[0.06] p-4 sm:p-5 shadow-sm">
      <p className="text-sm text-[#64748b]">Week {props.currentWeek} of {props.totalWeeks}</p>

      <div className="mt-3">
        <div className="h-3 w-full rounded-full bg-[#e2e8f0] overflow-hidden">
          <div className="h-full rounded-full bg-[#2d6a4f]" style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-2 text-xs text-[#64748b]">{props.currentWeek} of {props.totalWeeks} weeks complete</p>
      </div>

      <div className="mt-4 space-y-1 text-sm text-[#334155]">
        <p>You&apos;ve completed {props.totalSessionsCompleted} sessions across {props.currentWeek} weeks.</p>
        <p>
          You&apos;ve covered {props.totalKmCovered.toFixed(1)} km total
          {props.totalActualKmIsEstimated ? " (estimated)" : ""}.
        </p>
      </div>
    </section>
  );
}
