import prisma from "@/lib/db";
import { formatPace } from "@/lib/strava";
import { trainingPlan, type Phase, type RunType } from "@/data/trainingPlan";
import {
  PLAN_START_DATE,
  getPlanWeekForDate,
  getSessionDate,
  getWeeklyTargetKm,
} from "@/lib/planUtils";
import { calculateRunRating } from "@/lib/rating";
import { sameDayAEST, startOfDayAEST } from "@/lib/dateUtils";

export const dynamic = "force-dynamic";

const EFFORT_LABEL: Record<RunType, string> = {
  easy:     "Zone 2 effort",
  long:     "Zone 2 effort",
  tempo:    "Zone 4 effort",
  interval: "Zone 5 effort",
};

function fmtTargetPace(minPerKm: number): string {
  const m = Math.floor(minPerKm);
  const s = Math.round((minPerKm - m) * 60);
  return `${m}:${s.toString().padStart(2, "0")} /km`;
}

function ratingBadgeStyle(score: number): { background: string; color: string } {
  if (score >= 9)   return { background: "#2e1065", color: "#c4b5fd" };
  if (score >= 7.5) return { background: "#052e16", color: "#4ade80" };
  if (score >= 6)   return { background: "#0c1a2e", color: "#60a5fa" };
  if (score >= 4)   return { background: "#431407", color: "#fb923c" };
  return               { background: "#450a0a", color: "#f87171" };
}

function typePillStyle(type: RunType): { background: string; color: string } {
  switch (type) {
    case "easy":     return { background: "#1e1b4b", color: "#a5b4fc" };
    case "tempo":    return { background: "#134e4a", color: "#5eead4" };
    case "interval": return { background: "#431407", color: "#fb923c" };
    case "long":     return { background: "#292524", color: "#d6d3d1" };
  }
}

function phaseChipStyle(phase: Phase): { background: string; color: string } {
  switch (phase) {
    case "Base":                return { background: "#1e3a5f", color: "#93c5fd" };
    case "Half Marathon Build": return { background: "#14532d", color: "#86efac" };
    case "Marathon Build":      return { background: "#3b0764", color: "#d8b4fe" };
  }
}

export default async function ProgramPage() {
  const today        = new Date();
  const todayMidnight = startOfDayAEST(today);
  const rawWeek      = getPlanWeekForDate(today);
  const currentWeek  = rawWeek > 0 ? Math.min(trainingPlan.length, rawWeek) : 1;
  const currentPlanWeek = trainingPlan[currentWeek - 1];

  const planEnd = new Date(PLAN_START_DATE.getTime() + 18 * 7 * 24 * 60 * 60 * 1000);

  const [profile, activities, bestPaceRow] = await Promise.all([
    prisma.profile.findUnique({ where: { id: 1 } }),
    prisma.activity.findMany({
      where: {
        activityType: { in: ["running", "trail_running"] },
        date:         { gte: PLAN_START_DATE, lt: planEnd },
      },
    }),
    prisma.activity.findFirst({
      where:   { activityType: { in: ["running", "trail_running"] } },
      orderBy: { avgPaceSecKm: "asc" },
    }),
  ]);

  const athleteAge = profile?.dateOfBirth
    ? Math.floor(
        (Date.now() - new Date(profile.dateOfBirth).getTime()) / (365.25 * 86400000)
      )
    : 23;
  const pbPaceSecKm = bestPaceRow?.avgPaceSecKm ?? null;

  const phases: Phase[] = ["Base", "Half Marathon Build", "Marathon Build"];

  return (
    <div className="space-y-8">
      {/* ── Page header ────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="text-xl font-bold text-white">Training Program</h1>
        <span
          className="text-xs font-semibold px-2.5 py-1 rounded-full"
          style={phaseChipStyle(currentPlanWeek.phase)}
        >
          {currentPlanWeek.phase}
        </span>
        <span className="text-sm" style={{ color: "var(--text-muted)" }}>
          Week {currentWeek} of {trainingPlan.length}
        </span>
      </div>

      {/* ── Phases ─────────────────────────────────────────────────── */}
      {phases.map((phase) => {
        const phaseWeeks = trainingPlan.filter((w) => w.phase === phase);
        const phaseStart = phaseWeeks[0].week;
        const phaseEnd   = phaseWeeks[phaseWeeks.length - 1].week;
        const phaseTotal = phaseWeeks.length;
        const avgKm      =
          Math.round(
            (phaseWeeks.reduce((s, w) => s + getWeeklyTargetKm(w), 0) / phaseTotal) * 10
          ) / 10;
        const chip       = phaseChipStyle(phase);
        const progressPct = Math.max(
          0,
          Math.min(100, Math.round(((currentWeek - phaseStart) / phaseTotal) * 100))
        );

        return (
          <section key={phase} className="space-y-1.5">
            {/* Phase header */}
            <div
              className="rounded-xl px-4 py-3"
              style={{
                background: "#181818",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <div className="flex items-center justify-between gap-4 mb-2 flex-wrap">
                <div className="flex items-center gap-3 flex-wrap">
                  <span
                    className="text-xs font-semibold px-2.5 py-1 rounded-full"
                    style={chip}
                  >
                    {phase}
                  </span>
                  <span className="text-xs font-medium text-white">
                    Weeks {phaseStart}–{phaseEnd}
                  </span>
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                    ~{avgKm} km/week avg
                  </span>
                </div>
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                  {progressPct}% complete
                </span>
              </div>
              <div
                className="h-1 rounded-full overflow-hidden"
                style={{ background: "rgba(255,255,255,0.08)" }}
              >
                <div
                  className="h-full rounded-full"
                  style={{ width: `${progressPct}%`, background: chip.color }}
                />
              </div>
            </div>

            {/* Week rows */}
            {phaseWeeks.map((planWeek) => {
              const isCurrentWeek = planWeek.week === currentWeek;
              const weekTotalKm   = getWeeklyTargetKm(planWeek);

              return (
                <div
                  key={planWeek.week}
                  className="rounded-xl px-3 py-2.5"
                  style={{
                    background: isCurrentWeek ? "#1f1f1f" : "#181818",
                    border: "1px solid rgba(255,255,255,0.08)",
                  }}
                >
                  <div className="flex items-start gap-3">
                    {/* Week label */}
                    <div className="w-[84px] shrink-0 pt-2.5">
                      <p className="text-xs font-bold text-white leading-tight">
                        Week {planWeek.week}
                        {planWeek.isCutback && (
                          <span style={{ color: "#fbbf24" }}> · Cutback</span>
                        )}
                      </p>
                      {isCurrentWeek && (
                        <p
                          className="text-[11px] mt-0.5 leading-tight"
                          style={{ color: "#a5b4fc" }}
                        >
                          Current
                        </p>
                      )}
                    </div>

                    {/* Session cards */}
                    <div className="flex-1 grid grid-cols-3 gap-2 min-w-0">
                      {planWeek.sessions.map((session) => {
                        const sessionDate = getSessionDate(planWeek.week, session.day);
                        const isPast      = sessionDate < todayMidnight;
                        const isToday     = sameDayAEST(sessionDate, today);
                        const matchedAct  = activities.find((a) =>
                          sameDayAEST(new Date(a.date), sessionDate)
                        );
                        const isCompleted = !!matchedAct;
                        const showRating  = isCompleted && (isPast || isCurrentWeek);

                        let rating = null;
                        if (showRating && matchedAct) {
                          rating = calculateRunRating({
                            distanceKm:            matchedAct.distanceKm,
                            avgPaceSecKm:           matchedAct.avgPaceSecKm,
                            avgHeartRate:           matchedAct.avgHeartRate,
                            temperatureC:           matchedAct.temperatureC,
                            humidityPct:            matchedAct.humidityPct,
                            runType:                session.type,
                            personalBestPaceSecKm:  pbPaceSecKm,
                            athleteAgeYears:        athleteAge,
                          });
                        }

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

                        const pill     = typePillStyle(session.type);
                        const dayLabel = { wed: "Wed", sat: "Sat", sun: "Sun" }[session.day];

                        return (
                          <div
                            key={session.day}
                            className="rounded-lg p-3"
                            style={{
                              background:   "#111111",
                              borderTop:    "1px solid rgba(255,255,255,0.06)",
                              borderRight:  "1px solid rgba(255,255,255,0.06)",
                              borderBottom: "1px solid rgba(255,255,255,0.06)",
                              borderLeft:   leftBorder,
                            }}
                          >
                            {/* Day + rating badge */}
                            <div className="flex items-start justify-between gap-1 mb-2">
                              <span
                                className="text-[10px] font-semibold uppercase tracking-wider"
                                style={{ color: "var(--text-muted)" }}
                              >
                                {dayLabel}
                              </span>
                              {rating && (
                                <span
                                  className="text-[11px] font-bold px-1.5 py-0.5 rounded shrink-0"
                                  style={ratingBadgeStyle(rating.total)}
                                >
                                  {rating.total.toFixed(1)}
                                </span>
                              )}
                            </div>

                            {/* Run type pill */}
                            <span
                              className="inline-block text-[11px] px-2 py-0.5 rounded-full font-medium"
                              style={pill}
                            >
                              {session.type.charAt(0).toUpperCase() + session.type.slice(1)}
                            </span>

                            {/* Effort label */}
                            <p
                              className="text-[11px] mt-0.5 mb-2"
                              style={{ color: "rgba(232,230,224,0.35)" }}
                            >
                              {EFFORT_LABEL[session.type]}
                            </p>

                            {/* Description */}
                            <p className="text-xs font-medium text-white mb-1.5 leading-snug">
                              {session.description}
                            </p>

                            {/* Target */}
                            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                              {session.targetDistanceKm} km · {fmtTargetPace(session.targetPaceMinPerKm)}
                            </p>

                            {/* Actual (completed) */}
                            {showRating && matchedAct && (
                              <p
                                className="text-xs mt-0.5"
                                style={{ color: "rgba(232,230,224,0.4)" }}
                              >
                                {matchedAct.distanceKm.toFixed(2)} km · {formatPace(matchedAct.avgPaceSecKm)}
                              </p>
                            )}

                            {/* Today label */}
                            {isToday && (
                              <p
                                className="text-[11px] font-semibold mt-1.5"
                                style={{ color: "#a5b4fc" }}
                              >
                                Today
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Total km */}
                    <div className="w-14 shrink-0 text-right pt-2.5">
                      <p className="text-sm font-bold text-white">{weekTotalKm}</p>
                      <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                        km
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </section>
        );
      })}
    </div>
  );
}
