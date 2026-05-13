"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function NoviceInjuryPauseClient({ currentWeek }: { currentWeek: number }) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const resume = async () => {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/novice/resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weekNumber: currentWeek }),
      });
      if (!res.ok) throw new Error("resume_failed");
      router.push("/plan/novice");
      router.refresh();
    } catch {
      setErr("We couldn't resume your plan. Try again.");
      setBusy(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto px-4 py-16 space-y-8">
      <h1 className="text-2xl font-bold text-[#1e293b]">Your plan is paused.</h1>
      <p className="text-[#475569] leading-relaxed">
        You reported an injury — the right call is to rest and recover before continuing. Don&apos;t rush back.
      </p>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-[#94a3b8] mb-2">While you recover</p>
        <ul className="space-y-2 text-sm text-[#475569] list-disc pl-5">
          <li>Rest the area — avoid running until pain-free at rest</li>
          <li>If pain persists beyond a few days, see a physio or GP</li>
          <li>Light walking is fine if it feels comfortable</li>
          <li>Come back when you feel ready — your plan will be waiting</li>
        </ul>
      </div>

      {err ? <p className="text-sm text-red-700">{err}</p> : null}

      <button
        type="button"
        disabled={busy}
        onClick={() => setConfirmOpen(true)}
        className="w-full rounded-xl bg-[#2d6a4f] py-3.5 font-semibold text-white disabled:opacity-60"
      >
        Resume my plan — I&apos;m ready to run again
      </button>

      {confirmOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <div className="max-w-sm w-full rounded-2xl bg-[#faf8f5] p-6 shadow-xl space-y-4">
            <p className="text-[#1e293b] font-medium">Are you sure you&apos;re pain-free and ready to run?</p>
            <div className="flex flex-col gap-2">
              <button type="button" disabled={busy} className={btnPrimary} onClick={() => void resume()}>
                {busy ? "Working…" : "Yes, let's go"}
              </button>
              <button type="button" className={btnMuted} onClick={() => setConfirmOpen(false)} disabled={busy}>
                Not yet
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

const btnPrimary =
  "rounded-xl bg-[#2d6a4f] text-white font-semibold py-3 px-4 text-center w-full hover:opacity-95 transition";
const btnMuted = "rounded-xl bg-[#f1f5f9] text-[#475569] font-medium py-3 px-4 text-center w-full";
