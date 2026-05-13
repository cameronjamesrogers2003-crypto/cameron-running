"use client";

type SessionRow = {
  day: string;
  sessionType: string;
  plannedKm: number;
  actualKm: number | null;
  userRpe: number | null;
  completed: boolean;
  skippedReason: string | null;
};

type WeekDetail = {
  weekNumber: number;
  phase: string;
  plannedKm: number;
  actualKm: number | null;
  completionRate: number;
  averageRpe: number | null;
  adaptiveMutation: { mutationType: string; decisionReason: string } | null;
  sessions: SessionRow[];
  weekInsight: string;
};

type Props = {
  detail: WeekDetail | null;
};

function phaseLabel(phase: string): string {
  if (/taper/i.test(phase)) return "Taper";
  if (/cutback/i.test(phase)) return "Cutback";
  return "Building";
}

function statusText(s: SessionRow): string {
  if (!s.actualKm && !s.completed && !s.skippedReason) return "○ Upcoming";
  if (s.completed) return "✓ Done";
  return "✗ Missed";
}

export default function NoviceWeekDetailPanel({ detail }: Props) {
  if (!detail) {
    return (
      <section className="rounded-2xl bg-[#faf8f5] border border-black/[0.06] p-4 sm:p-5 shadow-sm">
        <p className="text-sm text-[#64748b]">Select a week to view details.</p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl bg-[#faf8f5] border border-black/[0.06] p-4 sm:p-5 shadow-sm space-y-4">
      <div>
        <p className="text-sm text-[#64748b]">Week {detail.weekNumber} · {phaseLabel(detail.phase)}</p>
        <p className="text-sm text-[#334155] mt-1">Planned: {detail.plannedKm.toFixed(1)} km across {detail.sessions.length} sessions</p>
        {detail.actualKm != null ? <p className="text-sm text-[#334155]">Actual: {detail.actualKm.toFixed(1)} km ({Math.round(detail.completionRate * 100)}%)</p> : null}
        {detail.averageRpe != null ? <p className="text-sm text-[#334155]">Weekly RPE average: {detail.averageRpe.toFixed(1)} / 10</p> : null}
      </div>

      {detail.adaptiveMutation ? (
        <div className="rounded-xl bg-[#eff6ff] border border-[#bfdbfe] p-3">
          <p className="text-sm font-medium text-[#1e3a8a]">{detail.adaptiveMutation.mutationType.replace(/_/g, " ")}</p>
          <p className="text-sm text-[#475569] mt-1">{detail.adaptiveMutation.decisionReason}</p>
        </div>
      ) : null}

      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[#64748b]">
              <th className="py-2">Day</th>
              <th className="py-2">Type</th>
              <th className="py-2">Planned</th>
              <th className="py-2">Actual</th>
              <th className="py-2">RPE</th>
              <th className="py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {detail.sessions.map((s, idx) => (
              <tr key={`${s.day}-${idx}`} className="border-t border-black/[0.06] text-[#334155]">
                <td className="py-2">{s.day}</td>
                <td className="py-2">{s.sessionType}</td>
                <td className="py-2">{s.plannedKm.toFixed(1)} km</td>
                <td className="py-2">{s.actualKm != null ? `${s.actualKm.toFixed(1)} km` : "—"}</td>
                <td className="py-2">{s.userRpe ?? "—"}</td>
                <td className="py-2">{statusText(s)}{s.skippedReason ? <span className="block text-xs text-[#94a3b8]">{s.skippedReason}</span> : null}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="sm:hidden space-y-2">
        {detail.sessions.map((s, idx) => (
          <div key={`${s.day}-${idx}`} className="rounded-xl border border-black/[0.06] bg-white p-3 text-sm text-[#334155]">
            <p className="font-medium">{s.day} · {s.sessionType}</p>
            <p>Planned: {s.plannedKm.toFixed(1)} km</p>
            <p>Actual: {s.actualKm != null ? `${s.actualKm.toFixed(1)} km` : "—"}</p>
            <p>RPE: {s.userRpe ?? "—"}</p>
            <p>{statusText(s)}</p>
            {s.skippedReason ? <p className="text-xs text-[#94a3b8]">Reason: {s.skippedReason}</p> : null}
          </div>
        ))}
      </div>

      <div className="rounded-xl bg-[#f8fafc] border border-black/[0.06] p-3">
        <p className="text-sm text-[#334155]">{detail.weekInsight}</p>
      </div>
    </section>
  );
}
