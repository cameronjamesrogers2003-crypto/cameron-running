"use client";

type Props = {
  longestRunKm: number | null;
  goalDistanceKm: number;
};

export default function NoviceLongestRunCard({ longestRunKm, goalDistanceKm }: Props) {
  const val = Math.max(0, longestRunKm ?? 0);
  const pct = Math.max(0, Math.min(100, (val / goalDistanceKm) * 100));
  const remaining = Math.max(0, goalDistanceKm - val);

  let prompt = "";
  if (val >= goalDistanceKm) prompt = `You've run ${goalDistanceKm} km. That's what this was all for.`;
  else if (pct >= 80) prompt = "Almost there. Your goal distance is within reach.";
  else if (pct >= 50) prompt = "Halfway there. Your body is adapting.";

  return (
    <section className="rounded-2xl bg-[#faf8f5] border border-black/[0.06] p-4 sm:p-5 shadow-sm">
      <h3 className="text-base font-semibold text-[#1e293b]">Your longest run so far</h3>
      <p className="mt-3 text-4xl font-bold text-[#1e293b]">{val.toFixed(1)} km</p>

      <div className="mt-3 text-sm text-[#64748b]">Goal: {goalDistanceKm} km</div>
      <div className="mt-2 h-3 rounded-full bg-[#e2e8f0] overflow-hidden">
        <div className="h-full rounded-full bg-[#2d6a4f]" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-2 text-sm text-[#475569]">
        {val >= goalDistanceKm ? "Goal distance reached ✓" : `${remaining.toFixed(1)} km to go`}
      </p>

      {prompt ? <p className="mt-3 text-sm text-[#334155]">{prompt}</p> : null}
    </section>
  );
}
