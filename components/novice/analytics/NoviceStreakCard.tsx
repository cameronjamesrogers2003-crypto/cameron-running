"use client";

import { Flame } from "lucide-react";

type Props = {
  currentStreak: number;
  bestStreak: number;
  thisWeekDots: Array<"done" | "upcoming" | "missed">;
};

function Dot({ state }: { state: "done" | "upcoming" | "missed" }) {
  if (state === "done") return <span className="text-[#16a34a]">●</span>;
  if (state === "missed") return <span className="text-[#b91c1c]">✕</span>;
  return <span className="text-[#94a3b8]">○</span>;
}

export default function NoviceStreakCard({ currentStreak, bestStreak, thisWeekDots }: Props) {
  const isHot = currentStreak >= bestStreak && currentStreak > 3;
  return (
    <section
      className="rounded-2xl border p-4 sm:p-5 shadow-sm"
      style={{
        background: isHot ? "#ecfdf5" : "#faf8f5",
        borderColor: "rgba(0,0,0,0.06)",
      }}
    >
      <div className="flex items-center gap-2">
        {currentStreak > 0 ? <Flame className="w-4 h-4 text-[#d97706]" /> : null}
        <h3 className="font-semibold text-[#1e293b]">Consistency</h3>
      </div>

      {currentStreak === 0 ? (
        <p className="mt-2 text-sm text-[#64748b]">Keep going — every session counts.</p>
      ) : (
        <p className="mt-2 text-sm text-[#334155]">Current streak: {currentStreak} sessions in a row</p>
      )}
      <p className="text-sm text-[#334155]">Best streak: {bestStreak} sessions in a row</p>

      <div className="mt-3 text-sm text-[#64748b]">
        This week:{" "}
        {thisWeekDots.map((d, i) => (
          <span key={i} className="inline-block mr-1"><Dot state={d} /></span>
        ))}
      </div>
    </section>
  );
}
