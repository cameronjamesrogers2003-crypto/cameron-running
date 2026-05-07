import type { Activity, PrismaClient } from "@prisma/client";
import type { RunType, TrainingWeek } from "@/data/trainingPlan";
import { generatePlan } from "@/lib/generatePlan";
import { dbSettingsToUserSettings, DEFAULT_SETTINGS } from "@/lib/settings";
import { loadGeneratedPlan, saveGeneratedPlan } from "@/lib/planStorage";
import {
  getEffectivePlanStart,
  getPlanWeekForDate,
  getSessionDate,
  isActivityOnOrAfterPlanStart,
  isPlannedRun,
} from "@/lib/planUtils";
import { sameDayAEST, startOfDayAEST } from "@/lib/dateUtils";

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function toDayMs(days: number): number {
  return days * 24 * 60 * 60 * 1000;
}

function weekAverageRating(
  plan: TrainingWeek[],
  planStart: Date,
  activities: Array<{ date: Date; rating: number | null }>,
  windowDays: number,
): { avg: number; count: number } {
  const cutoff = new Date(startOfDayAEST(new Date()).getTime() - toDayMs(windowDays));
  const qualifying = activities
    .filter((activity) => activity.rating != null && !Number.isNaN(activity.rating))
    .filter((activity) => activity.date >= cutoff)
    .filter((activity) => isActivityOnOrAfterPlanStart(activity.date, planStart))
    .filter((activity) => isPlannedRun(activity.date, plan, planStart));

  if (qualifying.length === 0) return { avg: 0, count: 0 };
  const avg = qualifying.reduce((sum, activity) => sum + (activity.rating ?? 0), 0) / qualifying.length;
  return { avg: round1(avg), count: qualifying.length };
}

function getSessionMinKm(level: "BEGINNER" | "INTERMEDIATE" | "ADVANCED", type: RunType): number {
  if (type === "long") return 5;
  if (level === "BEGINNER") return 3;
  if (level === "INTERMEDIATE") return 4;
  return 5;
}

function countConsecutiveSignificantMisses(missedCounts: number[]): number {
  let streak = 0;
  for (let i = missedCounts.length - 1; i >= 0; i--) {
    if ((missedCounts[i] ?? 0) >= 2) {
      streak++;
      continue;
    }
    break;
  }
  return streak;
}

export function getMissedSessionsForWeek(
  weekNumber: number,
  plan: TrainingWeek[],
  activities: Activity[],
  planStart: Date,
  lockedWeeks: number[],
): number {
  if (lockedWeeks.length > 0 && !lockedWeeks.includes(weekNumber)) return 0;
  const week = plan.find((entry) => entry.week === weekNumber);
  if (!week) return 0;
  const today = startOfDayAEST(new Date());
  const weekStart = getSessionDate(weekNumber, "sat", planStart);
  if (weekStart > today) return 0;

  let missed = 0;
  for (const session of week.sessions) {
    const sessionDate = getSessionDate(weekNumber, session.day, planStart);
    if (sessionDate >= today) continue;
    const done = activities.some((activity) => sameDayAEST(new Date(activity.date), sessionDate));
    if (!done) missed++;
  }
  return missed;
}

export async function checkAndAdaptPlan(prisma: PrismaClient): Promise<{
  adapted: boolean;
  reason: string | null;
  changes: string[];
}> {
  const [settingsRow, stored] = await Promise.all([
    prisma.userSettings.findUnique({ where: { id: 1 } }),
    loadGeneratedPlan(),
  ]);

  if (!stored?.plan?.length) {
    return { adapted: false, reason: "no active plan", changes: [] };
  }

  const settings = settingsRow ? dbSettingsToUserSettings(settingsRow) : DEFAULT_SETTINGS;
  const planStart = getEffectivePlanStart(settings.planStartDate);
  const currentWeek = getPlanWeekForDate(new Date(), planStart);
  if (currentWeek <= 0) {
    return { adapted: false, reason: "no active plan", changes: [] };
  }

  const lockedSet = new Set(stored.lockedWeeks);
  const nextIncompleteWeek = stored.plan.find((week) => !lockedSet.has(week.week));
  if (!nextIncompleteWeek) {
    return { adapted: false, reason: "no active plan", changes: [] };
  }

  const targetWeekNumber = nextIncompleteWeek.week;
  const activities = await prisma.activity.findMany({
    where: { activityType: { in: ["running", "trail_running"] } },
    orderBy: { date: "desc" },
    take: 120,
  });

  const recent3 = weekAverageRating(stored.plan, planStart, activities, 21);
  const recent5 = weekAverageRating(stored.plan, planStart, activities, 35);
  const plannedBase = generatePlan(stored.config);
  const baseWeek = plannedBase.find((week) => week.week === targetWeekNumber);
  const baseWeekCapKm = baseWeek
    ? round1(baseWeek.sessions.reduce((sum, session) => sum + session.targetDistanceKm, 0))
    : round1(nextIncompleteWeek.sessions.reduce((sum, session) => sum + session.targetDistanceKm, 0));

  const newPlan = stored.plan.map((week) => ({
    ...week,
    sessions: week.sessions.map((session) => ({ ...session })),
  }));
  const mutableWeek = newPlan.find((week) => week.week === targetWeekNumber);
  if (!mutableWeek) return { adapted: false, reason: "no active plan", changes: [] };

  const changes: string[] = [];
  let adaptationType:
    | "volume_reduced"
    | "volume_increased"
    | "soft_cutback"
    | "missed_sessions_warning"
    | "cutback_inserted"
    | "extended_recovery"
    | null = null;

  const canReduce = !(mutableWeek.adaptationNote ?? "").includes("Volume reduced 10%");
  const canIncrease = !(mutableWeek.adaptationNote ?? "").includes("Volume increased 5%");

  if (recent3.count >= 3 && recent3.avg < 6.0 && canReduce) {
    mutableWeek.sessions = mutableWeek.sessions.map((session) => {
      const minKm = getSessionMinKm(stored.config.level, session.type);
      return {
        ...session,
        targetDistanceKm: round1(Math.max(minKm, session.targetDistanceKm * 0.9)),
      };
    });
    mutableWeek.adaptationNote = `Volume reduced 10% — recent runs averaging ${recent3.avg.toFixed(1)}/10`;
    changes.push(`Reduced all session distances in week ${targetWeekNumber} by 10%.`);
    adaptationType = "volume_reduced";
  }

  if (recent5.count >= 5 && recent5.avg < 6.0) {
    const hardSession = mutableWeek.sessions.find((session) => session.type === "tempo" || session.type === "interval");
    if (hardSession) {
      hardSession.type = "easy";
      mutableWeek.softCutback = true;
      const note = `Hard session converted to easy — 5 weeks of below-average performance (${recent5.avg.toFixed(1)}/10)`;
      mutableWeek.adaptationNote = mutableWeek.adaptationNote
        ? `${mutableWeek.adaptationNote}; ${note}`
        : note;
      changes.push(`Converted hard session to easy in week ${targetWeekNumber}.`);
      adaptationType = "soft_cutback";
    }
  } else if (
    recent3.count >= 3
    && recent3.avg > 8.5
    && mutableWeek.phase !== "Taper"
    && canIncrease
  ) {
    const increased = mutableWeek.sessions.map((session) => ({
      ...session,
      targetDistanceKm: round1(session.targetDistanceKm * 1.05),
    }));
    const increasedTotal = round1(increased.reduce((sum, session) => sum + session.targetDistanceKm, 0));
    let adjusted = increased;
    if (increasedTotal > baseWeekCapKm && increasedTotal > 0) {
      const factor = baseWeekCapKm / increasedTotal;
      adjusted = increased.map((session) => ({
        ...session,
        targetDistanceKm: round1(session.targetDistanceKm * factor),
      }));
    }
    mutableWeek.sessions = adjusted.map((session) => ({
      ...session,
      targetDistanceKm: Math.max(getSessionMinKm(stored.config.level, session.type), session.targetDistanceKm),
    }));
    mutableWeek.adaptationNote = `Volume increased 5% — recent runs averaging ${recent3.avg.toFixed(1)}/10`;
    changes.push(`Increased all session distances in week ${targetWeekNumber} by 5% (capped by original plan).`);
    adaptationType = "volume_increased";
  }

  const completedWeeks = [...stored.lockedWeeks].sort((a, b) => a - b);
  const missedCounts = completedWeeks.map((weekNumber) =>
    getMissedSessionsForWeek(weekNumber, stored.plan, activities, planStart, stored.lockedWeeks),
  );
  const consecutiveMissWeeks = countConsecutiveSignificantMisses(missedCounts);
  const lastCompletedWeek = completedWeeks.length > 0 ? completedWeeks[completedWeeks.length - 1] : null;

  const canInsertCutback =
    mutableWeek.phase !== "Taper"
    && (settings.lastCutbackInsertedWeek == null || (targetWeekNumber - settings.lastCutbackInsertedWeek >= 4));

  if (consecutiveMissWeeks >= 3 && canInsertCutback) {
    const cutbackWeek: TrainingWeek = {
      ...mutableWeek,
      sessions: mutableWeek.sessions.map((session) => ({
        ...session,
        targetDistanceKm: round1(Math.max(getSessionMinKm(stored.config.level, session.type), session.targetDistanceKm * 0.7)),
      })),
      isCutback: true,
      adaptationNote:
        "Unplanned recovery week inserted — you've missed sessions for 2 weeks. Take it easy and rebuild consistency.",
    };

    const insertIdx = newPlan.findIndex((week) => week.week === targetWeekNumber);
    if (insertIdx >= 0) {
      for (let i = insertIdx; i < newPlan.length; i++) {
        newPlan[i] = { ...newPlan[i], week: newPlan[i].week + 1 };
      }
      cutbackWeek.week = targetWeekNumber;
      newPlan.splice(insertIdx, 0, cutbackWeek);
      const afterCutback = newPlan.find((week) => week.week === targetWeekNumber + 1);
      if (afterCutback) {
        const hardSession = afterCutback.sessions.find((session) => session.type === "tempo" || session.type === "interval");
        if (hardSession) hardSession.type = "easy";
        afterCutback.adaptationNote =
          "Extended recovery — returning to base training for one week before resuming normal schedule.";
      }
      changes.push(`Inserted unplanned cutback week before week ${targetWeekNumber}.`);
      changes.push("Converted the following week's hard session to easy for extended recovery.");
      adaptationType = "extended_recovery";
      await prisma.userSettings.update({
        where: { id: 1 },
        data: { lastCutbackInsertedWeek: targetWeekNumber },
      });
    }
  } else if (consecutiveMissWeeks >= 2 && canInsertCutback) {
    const cutbackWeek: TrainingWeek = {
      ...mutableWeek,
      sessions: mutableWeek.sessions.map((session) => ({
        ...session,
        targetDistanceKm: round1(Math.max(getSessionMinKm(stored.config.level, session.type), session.targetDistanceKm * 0.7)),
      })),
      isCutback: true,
      adaptationNote:
        "Unplanned recovery week inserted — you've missed sessions for 2 weeks. Take it easy and rebuild consistency.",
    };
    const insertIdx = newPlan.findIndex((week) => week.week === targetWeekNumber);
    if (insertIdx >= 0) {
      for (let i = insertIdx; i < newPlan.length; i++) {
        newPlan[i] = { ...newPlan[i], week: newPlan[i].week + 1 };
      }
      cutbackWeek.week = targetWeekNumber;
      newPlan.splice(insertIdx, 0, cutbackWeek);
      changes.push(`Inserted unplanned cutback week before week ${targetWeekNumber}.`);
      adaptationType = "cutback_inserted";
      await prisma.userSettings.update({
        where: { id: 1 },
        data: { lastCutbackInsertedWeek: targetWeekNumber },
      });
    }
  } else if (lastCompletedWeek != null) {
    const missedLastWeek = getMissedSessionsForWeek(
      lastCompletedWeek,
      stored.plan,
      activities,
      planStart,
      stored.lockedWeeks,
    );
    if (missedLastWeek >= 2 && !changes.some((change) => change.includes("cutback"))) {
      mutableWeek.adaptationNote =
        `You missed ${missedLastWeek} sessions last week. This week has been kept as planned — focus on showing up.`;
      changes.push(`Added missed-session warning note for week ${targetWeekNumber}.`);
      adaptationType = "missed_sessions_warning";
    }
  }

  if (changes.length === 0 || adaptationType == null) {
    return { adapted: false, reason: null, changes: [] };
  }

  // Safety guard: long run remains the longest target in adapted week.
  const longSession = mutableWeek.sessions.find((session) => session.type === "long");
  if (longSession) {
    for (const session of mutableWeek.sessions) {
      if (session.type !== "long" && session.targetDistanceKm > longSession.targetDistanceKm) {
        session.targetDistanceKm = longSession.targetDistanceKm;
      }
    }
  }

  await saveGeneratedPlan(stored.config, newPlan, stored.lockedWeeks);

  const reason =
    adaptationType === "soft_cutback"
      ? `Runs averaged ${recent5.avg.toFixed(1)}/10 across 5 weeks.`
      : adaptationType === "missed_sessions_warning"
        ? "You missed multiple planned sessions last week."
        : adaptationType === "cutback_inserted"
          ? "You missed multiple planned sessions for two consecutive weeks."
          : adaptationType === "extended_recovery"
            ? "You missed multiple planned sessions for three consecutive weeks."
      : adaptationType === "volume_reduced"
        ? `Runs averaged ${recent3.avg.toFixed(1)}/10 across 3 weeks.`
        : `Runs averaged ${recent3.avg.toFixed(1)}/10 across 3 weeks.`;

  await prisma.planAdaptation.create({
    data: {
      weekNumber: targetWeekNumber,
      type: adaptationType,
      reason,
      changes: JSON.stringify(changes),
    },
  });

  return { adapted: true, reason, changes };
}
