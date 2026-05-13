"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { formatMinPerKm } from "@/lib/noviceFormat";

export type NoviceGraduationClientProps = {
  completedGoal: "5k" | "10k";
  programWeeks: number;
  totalSessionsCompleted: number;
  totalKmCovered: number;
  peakWeeklyKm: number;
  estimatedPaceSecPerKm: number | null;
  suggestedNextGoal: "5k" | "10k" | "half";
  suggestedNextLevel: string;
};

function goalLabel(g: "5k" | "10k"): string {
  return g === "5k" ? "5K" : "10K";
}

function nextGoalWords(g: "5k" | "10k" | "half"): string {
  if (g === "half") return "half marathon";
  return goalLabel(g);
}

export function NoviceGraduationClient(props: NoviceGraduationClientProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const badge = props.completedGoal === "5k" ? "5K Complete" : "10K Complete";
  const dist = props.completedGoal === "5k" ? "5 kilometres" : "10 kilometres";
  const warm = `A few weeks ago this distance felt far away. Today you covered ${dist} without stopping.`;

  const startNext = async () => {
    setBusy(true);
    try {
      await fetch("/api/novice/graduate", { method: "POST" }).catch(() => null);
      const q = new URLSearchParams({
        goal: props.suggestedNextGoal,
        level: props.suggestedNextLevel || "BEGINNER",
      });
      router.push(`/onboarding?${q.toString()}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-5rem)] flex flex-col items-center justify-center px-4 py-12">
      <div className="max-w-lg w-full space-y-8 text-center">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[#ecfdf5] border-2 border-[#2d6a4f] [animation:novicePop_0.6s_ease-out_1]">
          <svg className="w-10 h-10 text-[#2d6a4f]" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M6 12l4 4 8-8"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <div>
          <p className="inline-flex rounded-full bg-[#2d6a4f] px-4 py-1.5 text-sm font-semibold text-white">{badge}</p>
          <h1 className="mt-4 text-3xl font-bold text-[#1e293b] tracking-tight">You did it.</h1>
          <p className="mt-3 text-[#475569] leading-relaxed">{warm}</p>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-[#94a3b8] mb-3">Your program in numbers</p>
          <div className="grid grid-cols-2 gap-3 text-left">
            <Stat label="Sessions completed" value={String(props.totalSessionsCompleted)} />
            <Stat label="Total km covered" value={props.totalKmCovered.toFixed(1)} />
            <Stat label="Peak weekly km" value={props.peakWeeklyKm.toFixed(1)} />
            <Stat label="Program weeks" value={String(props.programWeeks)} />
          </div>
          {props.estimatedPaceSecPerKm != null ? (
            <div className="mt-3 rounded-2xl bg-[#faf8f5] px-4 py-3 shadow-sm text-left">
              <p className="text-xs text-[#64748b]">Best pace (long runs)</p>
              <p className="text-lg font-semibold text-[#1e293b] mt-1">{formatMinPerKm(props.estimatedPaceSecPerKm)}</p>
            </div>
          ) : null}
        </div>

        <div className="border-t border-black/[0.06] pt-8 text-left space-y-3">
          <h2 className="text-lg font-semibold text-[#1e293b]">What&apos;s next?</h2>
          <p className="text-[#475569] leading-relaxed">
            You&apos;ve built the base. Now it&apos;s time to see what you can do with it. Your suggested next program:{" "}
            <span className="font-medium text-[#1e293b]">{nextGoalWords(props.suggestedNextGoal)}</span> — Beginner
            level.
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={() => void startNext()}
            className="mt-2 w-full rounded-xl bg-[#2d6a4f] py-3.5 font-semibold text-white disabled:opacity-60"
          >
            {busy ? "Loading…" : `Start my ${nextGoalWords(props.suggestedNextGoal)} program`}
          </button>
          <Link href="/" className="block w-full text-center text-sm text-[#64748b] py-2 underline">
            I&apos;ll decide later
          </Link>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-[#faf8f5] px-4 py-3 shadow-sm">
      <p className="text-xs text-[#64748b]">{label}</p>
      <p className="text-lg font-semibold text-[#1e293b] mt-1">{value}</p>
    </div>
  );
}
