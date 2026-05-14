"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Day, PlanConfig, Session, TrainingWeek } from "@/data/trainingPlan";
import { NoviceWeekStrip } from "@/components/novice/NoviceWeekStrip";
import { NoviceSessionCard, NoviceBridgeRunCard, type CheckinUiState, type NoviceCheckinSummary } from "@/components/novice/NoviceSessionCard";
import { NoviceCheckinModal } from "@/components/novice/NoviceCheckinModal";
import { NoviceAdaptiveDecisionCard, type AdaptiveDecision } from "@/components/novice/NoviceAdaptiveDecisionCard";

const DAY_ORDER: Day[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

export type SerializedCheckin = {
  sessionId: string;
  weekNumber: number;
  completed: boolean;
  userRpe: number;
  skippedReason: string | null;
  actualDistanceKm: number | null;
  distanceCompletionRatio: number | null;
};

export type SerializedEval = {
  id: string;
  weekNumber: number;
  adaptiveDecision: string;
  decisionReason: string;
  evaluatedAt: string;
};

export type PendingMatch = {
  sessionId: string;
  weekNumber: number;
  activityId: string;
  distanceKm: number;
  durationMin: number;
  avgPaceSecPerKm: number;
};

export type NovicePlanPageClientProps = {
  plan: TrainingWeek[];
  config: PlanConfig;
  checkinsByWeek: Record<number, SerializedCheckin[]>;
  evaluations: SerializedEval[];
  weekMeta: Record<number, { repeated?: boolean; reduced?: boolean }>;
  currentWeek: number;
  goalBadge: "5K Program" | "10K Program";
  /** When true, renders inside `/program` with dark shell (no duplicate light page chrome). */
  embedInProgram?: boolean;
};

function sessionState(
  session: Session,
  rows: SerializedCheckin[] | undefined,
  pendingIds: Set<string>,
  optimisticDone: Set<string>,
): CheckinUiState {
  if (optimisticDone.has(session.id)) return "checked_in_complete";
  const row = rows?.find((r) => r.sessionId === session.id);
  if (row) {
    if (!row.completed) return "missed";
    if (row.distanceCompletionRatio != null && row.distanceCompletionRatio < 0.95) return "checked_in_incomplete";
    return "checked_in_complete";
  }
  if (pendingIds.has(session.id)) return "strava_detected";
  return "not_started";
}

function summaryFromRow(row: SerializedCheckin): NoviceCheckinSummary {
  return {
    completed: row.completed,
    userRpe: row.userRpe,
    skippedReason: row.skippedReason,
    actualDistanceKm: row.actualDistanceKm,
  };
}

export function NovicePlanPageClient(props: NovicePlanPageClientProps) {
  const { plan, config, checkinsByWeek, evaluations, weekMeta, currentWeek, goalBadge, embedInProgram = false } = props;
  const router = useRouter();
  const [selectedWeek, setSelectedWeek] = useState(currentWeek);
  const [pending, setPending] = useState<PendingMatch[]>([]);
  const [optimisticDone, setOptimisticDone] = useState<Set<string>>(new Set());
  const [modalOpen, setModalOpen] = useState(false);
  const [modalSession, setModalSession] = useState<Session | null>(null);
  const [modalStrava, setModalStrava] = useState<PendingMatch | null>(null);
  const [modalActivityId, setModalActivityId] = useState<string | null>(null);

  const totalWeeks = plan.length;
  const weeksRemaining = Math.max(0, totalWeeks - selectedWeek);
  const evaluatedWeeks = useMemo(() => new Set(evaluations.map((e) => e.weekNumber)), [evaluations]);

  const latestNonProgress = useMemo(() => {
    const cur = evaluations
      .filter((e) => e.weekNumber === currentWeek)
      .slice()
      .sort((a, b) => b.evaluatedAt.localeCompare(a.evaluatedAt));
    return (
      cur.find((e) => e.adaptiveDecision !== "PROGRESS" && e.adaptiveDecision !== "PAUSE_INJURY") ?? null
    );
  }, [evaluations, currentWeek]);

  const fetchPending = useCallback(async () => {
    try {
      const res = await fetch("/api/novice/checkin/pending");
      if (!res.ok) return;
      const j = (await res.json()) as { matches?: PendingMatch[] };
      setPending(j.matches ?? []);
    } catch {
      void 0;
    }
  }, []);

  useEffect(() => {
    const boot = window.setTimeout(() => {
      void fetchPending();
    }, 0);
    const t = window.setInterval(() => void fetchPending(), 45000);
    return () => {
      window.clearTimeout(boot);
      window.clearInterval(t);
    };
  }, [fetchPending]);

  const pendingIds = useMemo(() => {
    const s = new Set<string>();
    for (const m of pending) if (m.weekNumber === selectedWeek) s.add(m.sessionId);
    return s;
  }, [pending, selectedWeek]);

  const weekRow = plan.find((w) => w.week === selectedWeek);
  const rows = checkinsByWeek[selectedWeek] ?? [];
  const canCheckIn = selectedWeek === currentWeek;
  const noopSession: (s: Session) => void = () => {};
  const noopReadonly: (s: Session, c: NoviceCheckinSummary) => void = () => {};

  const orderedSlots = useMemo(() => {
    if (!weekRow) return [];
    const byDay = new Map(weekRow.sessions.map((s) => [s.day, s] as const));
    const slots: { day: Day; session: Session | null }[] = [];
    for (const d of DAY_ORDER) {
      if (!config.days.includes(d)) continue;
      slots.push({ day: d, session: byDay.get(d) ?? null });
    }
    return slots;
  }, [weekRow, config.days]);

  const isFinalSession = useCallback(
    (session: Session) => {
      if (!weekRow) return false;
      const ordered = weekRow.sessions.slice().sort((a, b) => DAY_ORDER.indexOf(a.day) - DAY_ORDER.indexOf(b.day));
      return ordered[ordered.length - 1]?.id === session.id;
    },
    [weekRow],
  );

  const openCheckin = useCallback(
    (session: Session) => {
      const m = pending.find((p) => p.sessionId === session.id && p.weekNumber === selectedWeek);
      setModalSession(session);
      setModalStrava(m ?? null);
      setModalActivityId(m?.activityId ?? null);
      setModalOpen(true);
    },
    [pending, selectedWeek],
  );

  const plannedDurationMin = (session: Session) =>
    Math.max(1, Math.round(session.targetDistanceKm * session.targetPaceMinPerKm));

  const handleClose = useCallback(() => {
    setModalOpen(false);
    setModalSession(null);
    setModalStrava(null);
    setModalActivityId(null);
    router.refresh();
  }, [router]);

  const onOptimistic = useCallback((sessionId: string) => {
    setOptimisticDone((s) => new Set(s).add(sessionId));
  }, []);

  const onRevert = useCallback((sessionId: string) => {
    setOptimisticDone((s) => {
      const n = new Set(s);
      n.delete(sessionId);
      return n;
    });
  }, []);

  if (!weekRow) {
    return (
      <p
        className={`text-center py-8 ${embedInProgram ? "text-[var(--text-muted)]" : "text-[#64748b]"}`}
      >
        No sessions planned for this week.
      </p>
    );
  }

  const skin = embedInProgram ? "program" : "default";
  const weekStripVariant = embedInProgram ? "program" : "default";

  const headerInner = (
    <div className="flex flex-wrap items-center gap-2 text-sm sm:text-base">
      <span
        className={`rounded-full px-3 py-1 text-xs font-semibold ${
          embedInProgram ? "" : "bg-[#2d6a4f] text-white"
        }`}
        style={
          embedInProgram
            ? {
                background: "rgba(45,212,191,0.15)",
                color: "var(--accent)",
                border: "1px solid rgba(45,212,191,0.35)",
              }
            : undefined
        }
      >
        {goalBadge}
      </span>
      <span
        className="font-medium"
        style={{ color: embedInProgram ? "rgba(232,230,224,0.92)" : "#334155" }}
      >
        Week {selectedWeek} of {totalWeeks}
      </span>
      <span style={{ color: embedInProgram ? "rgba(232,230,224,0.35)" : "#94a3b8" }}>·</span>
      <span style={{ color: embedInProgram ? "var(--text-muted)" : "#64748b" }}>{weeksRemaining} weeks to go</span>
      <Link
        href="/plan/novice/progress"
        className={`ml-auto text-sm font-medium underline ${embedInProgram ? "" : "text-[#2d6a4f]"}`}
        style={embedInProgram ? { color: "var(--accent)" } : undefined}
      >
        My Progress →
      </Link>
    </div>
  );

  return (
    <div className={embedInProgram ? "w-full pb-6" : "max-w-[680px] mx-auto w-full px-3 sm:px-4 pb-28"}>
      {embedInProgram ? (
        <div className="mb-5 pb-4 border-b" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
          {headerInner}
        </div>
      ) : (
        <header className="sticky top-0 z-30 -mx-3 sm:-mx-4 px-3 sm:px-4 py-3 bg-[#f5f2eb]/95 backdrop-blur border-b border-black/[0.06] mb-4">
          {headerInner}
        </header>
      )}

      <NoviceWeekStrip
        totalWeeks={totalWeeks}
        selectedWeek={selectedWeek}
        currentWeek={currentWeek}
        onSelectWeek={setSelectedWeek}
        weekMeta={weekMeta}
        evaluatedWeeks={evaluatedWeeks}
        variant={weekStripVariant}
      />

      <div className="mt-6 space-y-4">
        {selectedWeek === currentWeek &&
        latestNonProgress &&
        (latestNonProgress.adaptiveDecision === "REPEAT_WEEK" ||
          latestNonProgress.adaptiveDecision === "REDUCE_LOAD" ||
          latestNonProgress.adaptiveDecision === "ACCELERATE") ? (
          <NoviceAdaptiveDecisionCard
            evaluationId={latestNonProgress.id}
            decision={latestNonProgress.adaptiveDecision as AdaptiveDecision}
            reason={latestNonProgress.decisionReason}
            skin={skin}
          />
        ) : null}

        {orderedSlots.map(({ day, session }) => {
          if (!session) {
            return (
              <p
                key={day}
                className="text-sm py-2"
                style={{ color: embedInProgram ? "var(--text-muted)" : "#64748b" }}
              >
                Rest day — recover well
              </p>
            );
          }
          const readOnly = selectedWeek < currentWeek;
          const st = sessionState(session, rows, pendingIds, optimisticDone);
          const checkinRow = rows.find((r) => r.sessionId === session.id);
          const checkin = checkinRow ? summaryFromRow(checkinRow) : undefined;
          if (session.type === "tempo") {
            return (
              <NoviceBridgeRunCard
                key={session.id}
                session={session}
                weekNumber={selectedWeek}
                state={st}
                checkin={checkin}
                readOnly={readOnly}
                onOpenCheckin={readOnly || !canCheckIn ? noopSession : () => openCheckin(session)}
                onOpenReadonly={readOnly && checkin ? noopReadonly : undefined}
                skin={skin}
              />
            );
          }
          return (
            <NoviceSessionCard
              key={session.id}
              session={session}
              weekNumber={selectedWeek}
              state={st}
              checkin={checkin}
              readOnly={readOnly}
              onOpenCheckin={readOnly || !canCheckIn ? noopSession : () => openCheckin(session)}
              onOpenReadonly={readOnly && checkin ? noopReadonly : undefined}
              skin={skin}
            />
          );
        })}
      </div>

      <NoviceCheckinModal
        open={modalOpen}
        onClose={handleClose}
        session={modalSession}
        weekNumber={selectedWeek}
        plannedDurationMin={modalSession ? plannedDurationMin(modalSession) : 0}
        stravaActivityId={modalActivityId}
        strava={
          modalStrava
            ? {
                distanceKm: modalStrava.distanceKm,
                durationMin: modalStrava.durationMin,
                avgPaceSecPerKm: modalStrava.avgPaceSecPerKm,
              }
            : null
        }
        isFinalSessionOfWeek={modalSession ? isFinalSession(modalSession) : false}
        onOptimistic={onOptimistic}
        onRevertOptimistic={onRevert}
        surface={embedInProgram ? "program" : "cream"}
      />

      {!embedInProgram ? (
        <p className="mt-10 text-center text-sm text-[#94a3b8]">
          <Link href="/program" className="underline text-[#475569]">
            Open full program view
          </Link>
        </p>
      ) : null}
    </div>
  );
}
