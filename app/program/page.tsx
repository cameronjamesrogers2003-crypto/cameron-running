import prisma from "@/lib/db";
import { formatPace as fmtPaceSec } from "@/lib/settings";
import { buildTrainingPlan, type Phase, type RunType, type TrainingWeek } from "@/data/trainingPlan";
import { finalizePlanDisplayCopy } from "@/lib/generatePlan";
import {
  getEffectivePlanStart,
  getPlanWeekForDate,
  getSessionDate,
  getWeeklyTargetKm,
  isActivityOnOrAfterPlanStart,
} from "@/lib/planUtils";
import { formatAEST, sameDayAEST, startOfDayAEST } from "@/lib/dateUtils";
import { dbSettingsToUserSettings, DEFAULT_SETTINGS } from "@/lib/settings";
import { parseInterruptionType, reconfigurePlan, type PlanInterruption } from "@/lib/interruptions";
import { loadGeneratedPlan } from "@/lib/planStorage";
import PhaseOverview from "./PhaseOverview";
import ProgramSidePanel from "./ProgramSidePanel";
import PlanAdjustments from "./PlanAdjustments";
import RaceFlagBanner from "./RaceFlagBanner";
import TodayLabel from "./TodayLabel";
import PlanUpdatedBanner from "./PlanUpdatedBanner";
import PageHeading from "@/components/ui/PageHeading";
import { RunTypePill } from "@/components/RunTypePill";
import PlanHistoryPanel from "./PlanHistoryPanel";
import { runTypeColor } from "@/lib/runTypeStyles";
import { phaseChipStyle } from "@/lib/phaseChipStyle";
import { EmptyState } from "@/components/EmptyState";
import { Calendar } from "lucide-react";

export const dynamic = "force-dynamic";
export const metadata = { title: "Runshift — Program" };

// ── Static lookup tables ──────────────────────────────────────────────────────

const EFFORT_LABEL: Record<RunType, string> = {
  easy:     "Zone 2 effort",
  long:     "Zone 2 effort",
  tempo:    "Zone 4 effort",
  interval: "Zone 5 effort",
};

const WARMUP_COOLDOWN: Record<RunType, string> = {
  easy:     "5 min walk each end",
  long:     "5 min jog + 10 min walk/stretch",
  tempo:    "1.5 km easy warm-up · 1 km cool-down",
  interval: "1.5 km easy warm-up · 90 sec rest between reps · 1 km cool-down",
};

const PHASE_OVERVIEW_FALLBACK: Partial<Record<Phase, string>> = {
  "Half Marathon Build":
    "This phase develops race-specific endurance and threshold fitness. Keep easy days easy so quality sessions stay sharp.",
  "Marathon Build":
    "Peak marathon training balances volume and intensity. Trust recovery and cutback weeks as part of the process.",
};

// ── HR zone bounds per run type ───────────────────────────────────────────────

const HR_ZONE_BOUNDS: Record<RunType, [number, number]> = {
  easy:     [0.60, 0.75],
  long:     [0.62, 0.78],
  tempo:    [0.78, 0.88],
  interval: [0.88, 0.96],
};

function getZoneBadge(
  avgHR: number | null | undefined,
  runType: RunType,
  maxHR: number
): { label: string; color: string } | null {
  if (!avgHR) return null;
  const [lo, hi] = HR_ZONE_BOUNDS[runType];
  const frac = avgHR / maxHR;
  if (frac >= lo && frac <= hi) return { label: "✓ Zone", color: "#5DCAA5" };
  if (frac > hi)                return { label: "↑ Zone", color: "#EF9F27" };
  return                               { label: "↓ Zone", color: "#85B7EB" };
}

// ── Volume change vs previous week in the plan ───────────────────────────────

function formatRunTypeWord(t: string | null | undefined): string {
  if (!t) return "Unclassified";
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function getVolumeChange(planWeek: TrainingWeek, plan: TrainingWeek[]): number | null {
  const idx = plan.indexOf(planWeek);
  if (idx <= 0) return null;
  const prev = plan[idx - 1];
  const prevKm = Math.round(getWeeklyTargetKm(prev) * 10) / 10;
  const currKm = Math.round(getWeeklyTargetKm(planWeek) * 10) / 10;
  if (prevKm === 0) return null;
  return Math.round(((currKm - prevKm) / prevKm) * 100);
}

// ── Style helpers ─────────────────────────────────────────────────────────────

function fmtTargetPace(minPerKm: number): string {
  const m = Math.floor(minPerKm);
  const s = Math.round((minPerKm - m) * 60);
  return `${m}:${s.toString().padStart(2, "0")} /km`;
}

function ratingBadgeStyle(score: number): { background: string; color: string } {
  if (score >= 9.0) return { background: "rgba(167,139,250,0.25)", color: "#a78bfa" };
  if (score >= 7.0) return { background: "rgba(74,222,128,0.25)", color: "#4ade80" };
  if (score >= 5.5) return { background: "rgba(45,212,191,0.25)", color: "var(--accent)" };
  if (score >= 4.0) return { background: "rgba(245,180,84,0.25)", color: "#f5b454" };
  return { background: "rgba(248,113,113,0.25)", color: "#f87171" };
}


function adaptationTypeDotColor(type: string): string {
  if (type === "volume_increased" || type === "vdot_improved") return "var(--accent)";
  if (type === "missed_sessions_warning" || type === "cutback_inserted") return "#f5b454";
  if (type === "volume_reduced" || type === "extended_recovery") return "var(--c-easy)";
  return "rgba(255,255,255,0.4)";
}

// ── Plan section grouping ─────────────────────────────────────────────────────

interface PlanSection {
  phase: Phase;
  weeks: TrainingWeek[];
  isRecovery: boolean;
  sectionIdx: number;
}

function groupIntoSections(plan: TrainingWeek[]): PlanSection[] {
  return plan.reduce<PlanSection[]>((acc, week) => {
    if (!acc.length || acc[acc.length - 1].phase !== week.phase) {
      acc.push({ phase: week.phase, weeks: [week], isRecovery: week.isRecovery ?? false, sectionIdx: acc.length });
    } else {
      acc[acc.length - 1].weeks.push(week);
    }
    return acc;
  }, []);
}

// ── Date formatter ────────────────────────────────────────────────────────────

function fmtWeekStartDate(weekNumber: number, planStart: Date): string {
  const d = new Date(planStart.getTime() + (weekNumber - 1) * 7 * 24 * 60 * 60 * 1000);
  // shift to AEST (+10h) to get local date
  const aest = new Date(d.getTime() + 10 * 60 * 60 * 1000);
  return aest.toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function ProgramPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = searchParams ? await searchParams : {};
  const updatedParam = params?.updated;
  const showUpdatedBanner = updatedParam === "true" || (Array.isArray(updatedParam) && updatedParam.includes("true"));
  const today        = new Date();
  const todayMidnight = startOfDayAEST(today);

  const [userSettingsRow, activities, interruptionRows, storedPlan, adaptationHistory] = await Promise.all([
    prisma.userSettings.findUnique({ where: { id: 1 } }),
    prisma.activity.findMany({
      where: { activityType: { in: ["running", "trail_running"] } },
      orderBy: { date: "desc" },
    }),
    prisma.planInterruption.findMany({ orderBy: { startDate: "asc" } }),
    loadGeneratedPlan(),
    prisma.planAdaptation.findMany({ orderBy: { createdAt: "desc" } }),
  ]);

  const settings   = userSettingsRow ? dbSettingsToUserSettings(userSettingsRow) : DEFAULT_SETTINGS;
  const planStart = getEffectivePlanStart(settings.planStartDate);
  const planStartDay = startOfDayAEST(planStart);
  const rawWeek = getPlanWeekForDate(today, planStart);
  const maxHR = settings.maxHR;

  if (!storedPlan?.plan?.length && !settings.experienceLevel) {
    return (
      <div className="program-shell w-full pt-2 pb-24 lg:pb-8">
        <div className="rounded-2xl border bg-[var(--card-bg)] border-white/[0.08]">
          <EmptyState
            icon={<Calendar className="w-7 h-7" style={{ color: "var(--accent)" }} />}
            title="No training plan yet"
            body="Complete your onboarding to generate a personalised training plan."
            action={{ label: "Get started", href: "/onboarding" }}
          />
        </div>
      </div>
    );
  }

  let planToRender: TrainingWeek[];
  let totalWeeksAdded = 0;
  let adjustmentSummary: string[] = [];
  let extendsPastRace = false;

  if (storedPlan?.plan?.length) {
    planToRender = storedPlan.plan;
  } else {
    // Build VDOT-adjusted base plan
    const basePlan = buildTrainingPlan(settings);

    // Compute normal weekly km from base plan
    const normalWeeklyKm =
      basePlan.reduce((sum, w) => sum + getWeeklyTargetKm(w), 0) / basePlan.length;

    // Map DB rows to PlanInterruption
    const interruptions: PlanInterruption[] = interruptionRows.map(row => ({
      id:               row.id,
      reason:           row.reason,
      type:             parseInterruptionType(row.type),
      startDate:        new Date(row.startDate),
      endDate:          row.endDate ? new Date(row.endDate) : null,
      weeklyKmEstimate: row.weeklyKmEstimate ?? null,
      notes:            row.notes ?? null,
      weeksAffected:    row.weeksAffected ?? null,
    }));

    const fallback = reconfigurePlan(basePlan, interruptions, {
      isBeginnerCurve: true,
      raceDate: settings.raceDate ? new Date(settings.raceDate) : null,
      normalWeeklyKm,
      planStart,
      experienceLevel: settings.experienceLevel ?? "BEGINNER",
    });
    planToRender = fallback.plan;
    totalWeeksAdded = fallback.totalWeeksAdded;
    adjustmentSummary = fallback.adjustmentSummary;
    extendsPastRace = fallback.extendsPastRace;
  }

  const runnerLevel = settings.experienceLevel ?? "BEGINNER";
  if (planToRender.length) {
    finalizePlanDisplayCopy(planToRender, runnerLevel);
  }

  const currentWeek = rawWeek > 0 ? Math.min(planToRender[planToRender.length - 1]?.week ?? 18, rawWeek) : 1;
  const currentPlanEntry = planToRender.find(w => w.week === currentWeek) ?? planToRender[0];

  const sections = groupIntoSections(planToRender);
  const lockedWeeks = new Set(storedPlan?.lockedWeeks ?? []);

  // Race date warning info
  const lastPlanWeek = planToRender[planToRender.length - 1];
  const planEndDateStr = lastPlanWeek ? fmtWeekStartDate(lastPlanWeek.week + 1, planStart) : "";
  const raceDateStr = settings.raceDate ? settings.raceDate.slice(0, 10) : "";
  const weeksOver = extendsPastRace && settings.raceDate && lastPlanWeek
    ? Math.ceil(
        (planStart.getTime() + lastPlanWeek.week * 7 * 24 * 60 * 60 * 1000 -
          new Date(settings.raceDate).getTime()) /
          (7 * 24 * 60 * 60 * 1000)
      )
    : 0;

  return (
    <div className="program-shell flex flex-col lg:flex-row items-start gap-0 lg:gap-3 w-full min-w-0">

      {/* ── Main content ─────────────────────────────────────────────── */}
      <div className="flex-1 min-w-0 w-full space-y-5 sm:space-y-6 lg:pr-4">

        {/* Page header */}
        <div className="flex items-start justify-between pt-2 mb-6 gap-3.5">
          <div className="flex-1 min-w-0">
            <PageHeading>Training Program</PageHeading>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <span
                className="text-xs font-semibold px-2.5 py-1 rounded-full"
                style={phaseChipStyle(currentPlanEntry?.phase ?? "Base")}
              >
                {currentPlanEntry?.phase ?? "Base"}
              </span>
              <span className="text-sm" style={{ color: "var(--text-muted)" }}>
                Week {currentWeek} of {planToRender.length}
              </span>
            </div>
          </div>
        </div>

        {/* Race flag banner (only when plan extends past race date) */}
        {extendsPastRace && settings.raceDate && (
          <RaceFlagBanner
            planEndDate={planEndDateStr}
            raceDate={raceDateStr}
            weeksOver={weeksOver}
          />
        )}

        {/* Plan adjustments panel */}
        {adjustmentSummary.length > 0 && (
          <PlanAdjustments
            adjustmentSummary={adjustmentSummary}
            totalWeeksAdded={totalWeeksAdded}
            newPlanEndDate={planEndDateStr}
          />
        )}
        {showUpdatedBanner && (
          <PlanUpdatedBanner fromWeek={currentWeek} />
        )}

        {/* Plan sections */}
        {sections.map((section) => {
          const phaseStart  = section.weeks[0].week;
          const phaseEnd    = section.weeks[section.weeks.length - 1].week;
          const phaseTotal  = section.weeks.length;
          const avgKm       =
            Math.round(
              (section.weeks.reduce((s, w) => s + getWeeklyTargetKm(w), 0) / phaseTotal) * 10
            ) / 10;
          const chip        = phaseChipStyle(section.phase);
          const progressPct = Math.max(
            0,
            Math.min(100, Math.round(((currentWeek - phaseStart) / phaseTotal) * 100))
          );

          return (
            <section key={`${section.phase}-${section.sectionIdx}`} className="space-y-1.5">

              {/* Phase header */}
              {section.isRecovery ? (
                // Simplified recovery header
                <div className="rounded-2xl border bg-[var(--card-bg)] border-white/[0.08] backdrop-blur-sm px-3 py-2.5 sm:px-4">
                  <div className="flex items-center gap-2 sm:gap-3 flex-wrap text-xs sm:text-sm">
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={chip}>
                      Return to Training
                    </span>
                    <span className="text-xs font-medium text-white">
                      Week{phaseTotal > 1 ? "s" : ""} {phaseStart}{phaseTotal > 1 ? `–${phaseEnd}` : ""}
                    </span>
                    <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                      ~{avgKm.toFixed(1)} km/week · easy effort only
                    </span>
                  </div>
                </div>
              ) : (
                // Full phase header
                <div className="rounded-2xl border bg-[var(--card-bg)] border-white/[0.08] backdrop-blur-sm px-3 py-2.5 sm:px-4">
                  <div className="flex items-center justify-between gap-3 sm:gap-4 mb-1.5 flex-wrap">
                    <div className="flex items-center gap-2 sm:gap-3 flex-wrap min-w-0">
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={chip}>
                        {section.phase}
                      </span>
                      <span className="text-xs font-medium text-white">
                        Weeks {phaseStart}–{phaseEnd}
                      </span>
                      <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                        ~{avgKm.toFixed(1)} km/week avg
                      </span>
                    </div>
                    <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                      {progressPct}% complete
                    </span>
                  </div>
                  <div className="h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
                    <div className="h-full rounded-full" style={{ width: `${progressPct}%`, background: chip.color }} />
                  </div>
                </div>
              )}

              {/* Phase overview — dynamic copy from plan; legacy fallback for rare phases */}
              {(() => {
                const overview =
                  section.weeks[0]?.phaseOverviewText
                  ?? (!section.isRecovery ? PHASE_OVERVIEW_FALLBACK[section.phase] : "")
                  ?? "";
                return overview ? <PhaseOverview description={overview} /> : null;
              })()}

              {/* Week rows */}
              {section.weeks.map((planWeek) => {
                const isCurrentWeek = planWeek.week === currentWeek;
                const isLockedWeek = lockedWeeks.has(planWeek.week);
                const weekTotalKm   = getWeeklyTargetKm(planWeek);
                const volumeChange  = getVolumeChange(planWeek, planToRender);
                const focusLabel = planWeek.weekSubtitle;

                const extraRuns = activities.filter((a) => {
                  const d = new Date(a.date);
                  if (!isActivityOnOrAfterPlanStart(d, planStart)) return false;
                  const weekNum = getPlanWeekForDate(d, planStart);
                  if (weekNum !== planWeek.week) return false;
                  return !planWeek.sessions.some((s) =>
                    sameDayAEST(d, getSessionDate(planWeek.week, s.day, planStart)),
                  );
                });

                return (
                  <div
                    key={planWeek.week}
                    className="rounded-xl px-3 py-2.5 mb-4.5"
                    style={{
                      background: isCurrentWeek
                        ? "rgba(20,184,166,0.03)"
                        : isLockedWeek
                          ? "rgba(255,255,255,0.02)"
                          : "rgba(255,255,255,0.02)",
                      border: isCurrentWeek
                        ? "1px solid rgba(45,212,191,0.30)"
                        : isLockedWeek
                          ? "1px solid rgba(255,255,255,0.05)"
                          : "1px solid rgba(255,255,255,0.08)",
                      borderLeft:  planWeek.isRecovery
                        ? "2px solid rgba(167,139,250,0.4)"
                        : undefined,
                      opacity: isCurrentWeek ? 1 : isLockedWeek ? 0.55 : 0.85,
                      boxShadow: isCurrentWeek
                        ? "0 0 0 1px rgba(45,212,191,0.15), 0 4px 24px rgba(45,212,191,0.06)"
                        : undefined,
                    }}
                  >
                    {/* Weekly focus label */}
                    {focusLabel && (
                      <p
                        className="text-xs mb-1.5 pl-0 sm:pl-[87px]"
                        style={{ color: "rgba(232,230,224,0.3)" }}
                      >
                        {focusLabel}
                      </p>
                    )}

                    <div className="flex flex-col gap-2.5 sm:flex-row sm:items-start sm:gap-3">
                      {/* Week label */}
                      <div className="w-full sm:w-[84px] shrink-0 pt-0 sm:pt-1 flex sm:block items-center justify-between sm:justify-start gap-2">
                        <p className="text-xs font-bold text-white leading-tight">
                          Week {planWeek.week}
                        </p>
                        <div className="flex flex-wrap gap-1 mt-1 sm:mt-1.5 justify-end sm:justify-start">
                          {planWeek.phase === "Taper" && (
                            <span
                              className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold"
                              style={{
                                background: "rgba(167,139,250,0.15)",
                                color: "#a78bfa",
                                border: "1px solid rgba(167,139,250,0.30)",
                              }}
                            >
                              Taper
                            </span>
                          )}
                          {planWeek.isRecovery && (
                            <span
                              className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold"
                              style={{
                                background: "rgba(125,211,252,0.15)",
                                color: "var(--c-easy)",
                                border: "1px solid rgba(125,211,252,0.30)",
                              }}
                            >
                              Recovery
                            </span>
                          )}
                          {planWeek.isCutback && (
                            <span
                              className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold"
                              style={{
                                background: "rgba(245,180,84,0.15)",
                                color: "#f5b454",
                                border: "1px solid rgba(245,180,84,0.30)",
                              }}
                            >
                              Cutback
                            </span>
                          )}
                          {isCurrentWeek && (
                            <span
                              className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold"
                              style={{
                                background: "rgba(45,212,191,0.15)",
                                color: "var(--accent)",
                                border: "1px solid rgba(45,212,191,0.30)",
                              }}
                            >
                              Current
                            </span>
                          )}
                          {!isCurrentWeek && isLockedWeek && (
                            <span
                              className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold"
                              style={{
                                background: "rgba(255,255,255,0.08)",
                                color: "rgba(255,255,255,0.40)",
                                border: "1px solid rgba(255,255,255,0.12)",
                              }}
                            >
                              Completed
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Session cards + extra runs */}
                      <div className="flex-1 min-w-0 w-full space-y-1.5">
                        <div
                          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 overflow-x-auto min-w-0 w-full"
                          style={{ gridTemplateColumns: `repeat(${planWeek.sessions.length}, minmax(160px, 1fr))` }}
                        >
                        {planWeek.sessions.map((session) => {
                          const sessionDate = getSessionDate(planWeek.week, session.day, planStart);
                          const showSessionToday =
                            todayMidnight.getTime() >= planStartDay.getTime()
                            && sameDayAEST(sessionDate, todayMidnight);
                          const startsLabelText =
                            todayMidnight.getTime() < planStartDay.getTime()
                            && sameDayAEST(sessionDate, planStartDay)
                              ? `Starts ${formatAEST(planStartDay, "EEE d MMM")}`
                              : null;
                          const isPast      = sessionDate < todayMidnight;
                          const sameDayRuns = activities.filter((a) => {
                            const d = new Date(a.date);
                            return (
                              isActivityOnOrAfterPlanStart(d, planStart)
                              && sameDayAEST(d, sessionDate)
                            );
                          });
                          const matchedAct =
                            sameDayRuns.find((a) => a.classifiedRunType === session.type)
                            ?? sameDayRuns[0];
                          const isCompleted = !!matchedAct;
                          const runTypeMismatch =
                            !!matchedAct && matchedAct.classifiedRunType !== session.type;
                          const showRating  = isCompleted && (isPast || isCurrentWeek);

                          const ratingNum =
                            showRating && matchedAct && matchedAct.rating != null && !Number.isNaN(matchedAct.rating)
                              ? matchedAct.rating
                              : null;

                          const zoneBadge = showRating && matchedAct
                            ? getZoneBadge(matchedAct.avgHeartRate, session.type, maxHR)
                            : null;

                          let leftBorder: string;
                          if (planWeek.isCutback) {
                            leftBorder = "2px solid #854F0B";
                          } else if (showRating) {
                            leftBorder = "2px solid #1D9E75";
                          } else if (isCurrentWeek && !isCompleted) {
                            leftBorder = "2px solid #534AB7";
                          } else {
                            leftBorder = "1px solid rgba(255,255,255,0.06)";
                          }

                          const dayLabel = session.day.toUpperCase();
                          const cardBg = session.type === "long"
                            ? "rgba(167,139,250,0.06)"
                            : session.type === "easy"
                              ? "rgba(125,211,252,0.03)"
                              : "var(--card-bg)";

                          return (
                            <div
                              key={session.day}
                              className="rounded-2xl overflow-hidden border border-white/[0.08] min-w-[160px]"
                              style={{
                                background: cardBg,
                                borderLeft: leftBorder,
                              }}
                            >
                              <div
                                style={{
                                  height: "3px",
                                  background: runTypeColor(session.type),
                                  width: "100%",
                                  flexShrink: 0,
                                }}
                              />
                              <div className="p-4">
                              {/* Day + rating + zone badges */}
                              <div className="flex items-start justify-between gap-1 mb-1.5">
                                <span
                                  className="text-xs font-semibold uppercase tracking-wider"
                                  style={{ color: "var(--text-muted)" }}
                                >
                                  {dayLabel}
                                </span>
                                <div className="flex flex-col items-end gap-0.5 shrink-0">
                                  {ratingNum != null && (
                                    <span
                                      className="text-xs font-bold px-1.5 py-0.5 rounded"
                                      style={ratingBadgeStyle(ratingNum)}
                                    >
                                      {ratingNum.toFixed(1)}
                                    </span>
                                  )}
                                  {zoneBadge && (
                                    <span
                                      className="text-xs font-medium px-1.5 py-0.5 rounded"
                                      style={{
                                        color:      zoneBadge.color,
                                        background: `${zoneBadge.color}22`,
                                      }}
                                    >
                                      {zoneBadge.label}
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Run type pill */}
                              <RunTypePill type={session.type} size="sm" />

                              {runTypeMismatch && (
                                <p
                                  className="text-xs mt-1.5 leading-snug rounded px-1.5 py-1"
                                  style={{
                                    background: "rgba(245,158,11,0.14)",
                                    color: "#fbbf24",
                                  }}
                                >
                                  ⚠️ Run type mismatch — planned: {formatRunTypeWord(session.type)}, actual:{" "}
                                  {formatRunTypeWord(matchedAct.classifiedRunType)}
                                </p>
                              )}

                              {/* Effort label */}
                              <p
                                className="text-xs mt-0.5 mb-1.5"
                                style={{ color: "rgba(232,230,224,0.35)" }}
                              >
                                {EFFORT_LABEL[session.type]}
                              </p>

                              {/* Description */}
                              <p className="text-sm font-semibold text-white mb-0.5 leading-snug">
                                {session.description}
                              </p>

                              {/* Warm-up / cool-down */}
                              <p
                                className="hidden sm:block text-xs mb-1 leading-snug"
                                style={{ color: "rgba(232,230,224,0.25)" }}
                              >
                                {WARMUP_COOLDOWN[session.type]}
                              </p>

                              {/* Target */}
                              <p className="font-mono font-semibold text-sm whitespace-nowrap text-white">
                                {session.targetDistanceKm.toFixed(1)} km · {fmtTargetPace(session.targetPaceMinPerKm)}
                              </p>

                              {/* Actual (completed) */}
                              {showRating && matchedAct && (
                                <p
                                  className="text-xs mt-0.5 font-mono"
                                  style={{ color: "rgba(232,230,224,0.4)" }}
                                >
                                  {matchedAct.distanceKm.toFixed(1)} km · {fmtPaceSec(matchedAct.avgPaceSecKm)}
                                </p>
                              )}

                              {/* Today label */}
                              <TodayLabel showToday={showSessionToday} startsText={startsLabelText} />
                              </div>
                            </div>
                          );
                        })}
                        </div>

                        {extraRuns.length > 0 && (
                          <p
                            className="text-xs leading-relaxed pl-0 sm:pl-0"
                            style={{ color: "rgba(232,230,224,0.38)" }}
                          >
                            <span className="font-medium" style={{ color: "rgba(232,230,224,0.5)" }}>
                              Extra runs this week:
                            </span>{" "}
                            {extraRuns.map((a, i) => (
                              <span key={a.id}>
                                {formatAEST(a.date, "EEE d MMM")} — {a.distanceKm.toFixed(1)} km{" "}
                                {formatRunTypeWord(a.classifiedRunType)}
                                {i < extraRuns.length - 1 ? "; " : ""}
                              </span>
                            ))}
                          </p>
                        )}
                      </div>

                      {/* Total km + volume change */}
                      <div className="w-full sm:w-16 shrink-0 text-right ml-3 pt-0 sm:pt-1 flex sm:block items-center justify-between sm:justify-end gap-2">
                        <p className="text-sm font-bold text-white font-mono">{weekTotalKm.toFixed(1)}</p>
                        <p className="text-xs" style={{ color: "var(--text-muted)" }}>km</p>
                        {volumeChange !== null && (
                          <span
                            className="text-xs font-medium mt-1 inline-block px-1.5 py-0.5 rounded-sm"
                            style={{
                              background: volumeChange > 0
                                ? "rgba(93,202,165,0.12)"
                                : "rgba(239,159,39,0.12)",
                              color: volumeChange > 0 ? "#5DCAA5" : "#EF9F27",
                            }}
                          >
                            {volumeChange > 0 ? `↑${volumeChange}%` : `↓${Math.abs(volumeChange)}%`}
                          </span>
                        )}
                      </div>
                    </div>
                    {planWeek.adaptationNote && (
                      <div
                        className="flex items-start gap-2 mt-2.5 px-3 py-1.5 rounded-lg text-xs"
                        style={{
                          background: "rgba(245,180,84,0.08)",
                          border: "1px solid rgba(245,180,84,0.20)",
                          color: "#f5b454",
                        }}
                      >
                        <span>⚡</span>
                        <span>{planWeek.adaptationNote}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </section>
          );
        })}
        <PlanHistoryPanel
          items={adaptationHistory.map((item) => ({
            id: item.id,
            dateLabel: new Date(item.createdAt).toLocaleDateString("en-AU"),
            type: item.type,
            weekNumber: item.weekNumber,
            reason: item.reason,
            dotColor: adaptationTypeDotColor(item.type),
          }))}
        />
      </div>

      {/* ── Side panel (desktop) ─────────────────────────────────────── */}
      <div className="hidden lg:block shrink-0">
        <ProgramSidePanel maxHR={maxHR} />
      </div>
    </div>
  );
}
