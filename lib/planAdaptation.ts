import type { Activity, PrismaClient } from "@prisma/client";
import type { PlanConfig, RunType, TrainingWeek } from "@/data/trainingPlan";
import { generatePlan } from "@/lib/generatePlan";
import { dbSettingsToUserSettings, DEFAULT_SETTINGS, type UserSettings } from "@/lib/settings";
import { loadGeneratedPlan, saveGeneratedPlan } from "@/lib/planStorage";
import { inferRunType } from "@/lib/rating";
import { deriveRatingPaceZones, getSessionPacesMinPerKm } from "@/lib/planPaces";
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

function median(nums: number[]): number | null {
  if (nums.length === 0) return null;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid] ?? null;
  const lo = sorted[mid - 1];
  const hi = sorted[mid];
  return lo != null && hi != null ? (lo + hi) / 2 : null;
}

function estimateRunVdot(distanceKm: number, avgPaceSecKm: number): number | null {
  if (!Number.isFinite(distanceKm) || !Number.isFinite(avgPaceSecKm) || distanceKm <= 0 || avgPaceSecKm <= 0) {
    return null;
  }
  const minutes = (distanceKm * avgPaceSecKm) / 60;
  const metres = distanceKm * 1000;
  const velocity = metres / minutes;
  const pct =
    0.8
    + 0.1894393 * Math.exp(-0.012778 * minutes)
    + 0.2989558 * Math.exp(-0.1932605 * minutes);
  if (pct <= 0) return null;
  const vo2 = (-4.6 + 0.182258 * velocity + 0.000104 * velocity * velocity) / pct;
  return Number.isFinite(vo2) && vo2 > 0 ? vo2 : null;
}

export function estimateCurrentVdot(activities: Activity[], settings: UserSettings): number | null {
  const recentWithData = activities
    .filter((activity) => activity.distanceKm > 0 && activity.avgPaceSecKm > 0)
    .slice(0, 10);

  const estimates: number[] = [];
  for (const activity of recentWithData) {
    if (activity.distanceKm < 3) continue;
    const runType = inferRunType(activity, settings);
    if (runType !== "tempo" && runType !== "interval") continue;
    const estimated = estimateRunVdot(activity.distanceKm, activity.avgPaceSecKm);
    if (estimated != null) estimates.push(estimated);
  }

  if (estimates.length < 3) return null;
  const mid = median(estimates);
  return mid == null ? null : Math.round(mid);
}

export function rebuildPaceTargets(
  plan: TrainingWeek[],
  lockedWeeks: number[],
  settings: UserSettings,
  vdotOverride?: number,
): TrainingWeek[] {
  const lockedSet = new Set(lockedWeeks);
  const vdot = Math.round(vdotOverride ?? settings.currentVdot);
  const pMin = getSessionPacesMinPerKm(vdot, settings);
  return plan.map((week) => {
    if (lockedSet.has(week.week)) return week;
    return {
      ...week,
      sessions: week.sessions.map((session) => ({
        ...session,
        targetPaceMinPerKm:
          session.type === "long"
            ? pMin.long
            : session.type === "tempo"
              ? pMin.tempo
              : session.type === "interval"
                ? pMin.interval
                : pMin.easy,
      })),
    };
  });
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
  const name = settings.firstName ?? "Runner";
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
  const mergedConfig: PlanConfig = {
    ...stored.config,
    paceAdjust: {
      easyPaceOffsetSec: settings.easyPaceOffsetSec,
      tempoPaceOffsetSec: settings.tempoPaceOffsetSec,
      intervalPaceOffsetSec: settings.intervalPaceOffsetSec,
      longPaceOffsetSec: settings.longPaceOffsetSec,
      runningExperience: settings.runningExperience,
    },
  };
  const plannedBase = generatePlan(mergedConfig);
  const baseWeek = plannedBase.find((week) => week.week === targetWeekNumber);
  const baseWeekCapKm = baseWeek
    ? round1(baseWeek.sessions.reduce((sum, session) => sum + session.targetDistanceKm, 0))
    : round1(nextIncompleteWeek.sessions.reduce((sum, session) => sum + session.targetDistanceKm, 0));

  const newPlan = stored.plan.map((week) => ({
    ...week,
    sessions: week.sessions.map((session) => ({ ...session })),
  }));
  const now = new Date();

  const withinCooldown = settings.lastAdaptationDate
    ? now.getTime() - new Date(settings.lastAdaptationDate).getTime() < toDayMs(7)
    : false;

  const mutableWeek = newPlan.find((week) => week.week === targetWeekNumber);
  if (!mutableWeek) return { adapted: false, reason: "no active plan", changes: [] };

  const changes: string[] = [];
  let adaptationType: string | null = null;
  let ratingRuleApplied = false;
  let missedRuleApplied = false;

  const canReduce = !(mutableWeek.adaptationNote ?? "").includes("Volume reduced 10%");
  const canIncrease = !(mutableWeek.adaptationNote ?? "").includes("Volume increased 5%");

  if (!withinCooldown && recent3.count >= 3 && recent3.avg < 6.0 && canReduce) {
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
    ratingRuleApplied = true;
  }

  if (!withinCooldown && !ratingRuleApplied && recent5.count >= 5 && recent5.avg < 6.0) {
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
      ratingRuleApplied = true;
    }
  } else if (
    !withinCooldown
    && !ratingRuleApplied
    && !missedRuleApplied
    &&
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
    ratingRuleApplied = true;
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

  if (!withinCooldown && consecutiveMissWeeks >= 3 && canInsertCutback) {
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
      if (!ratingRuleApplied) adaptationType = "extended_recovery";
      missedRuleApplied = true;
      await prisma.userSettings.update({
        where: { id: 1 },
        data: { lastCutbackInsertedWeek: targetWeekNumber },
      });
    }
  } else if (!withinCooldown && consecutiveMissWeeks >= 2 && canInsertCutback) {
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
      if (!ratingRuleApplied) adaptationType = "cutback_inserted";
      missedRuleApplied = true;
      await prisma.userSettings.update({
        where: { id: 1 },
        data: { lastCutbackInsertedWeek: targetWeekNumber },
      });
    }
  } else if (!withinCooldown && !missedRuleApplied && lastCompletedWeek != null) {
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
      if (!ratingRuleApplied) adaptationType = "missed_sessions_warning";
      missedRuleApplied = true;
    }
  }

  if (ratingRuleApplied || missedRuleApplied) {
    // Safety guard: long run remains the longest target in adapted week.
    const longSession = mutableWeek.sessions.find((session) => session.type === "long");
    if (longSession) {
      for (const session of mutableWeek.sessions) {
        if (session.type !== "long" && session.targetDistanceKm > longSession.targetDistanceKm) {
          session.targetDistanceKm = longSession.targetDistanceKm;
        }
      }
    }
  }

  const vdotEstimate = estimateCurrentVdot(activities, settings);
  const vdotStable = vdotEstimate != null && settings.lastEstimatedVdot != null && settings.lastEstimatedVdot === vdotEstimate;
  const vdotShouldUpdate =
    vdotEstimate != null
    && vdotEstimate > settings.currentVdot + 2
    && vdotStable
    && !missedRuleApplied;

  if (vdotShouldUpdate) {
    const prior = settings.currentVdot;
    const rebuilt = rebuildPaceTargets(newPlan, stored.lockedWeeks, settings, vdotEstimate);
    newPlan.splice(0, newPlan.length, ...rebuilt);
    adaptationType = adaptationType ?? "vdot_improved";
    changes.push(`Updated VDOT from ${prior} to ${vdotEstimate} and rebuilt pace targets for unlocked weeks.`);
    const settingsWithNewVdot: UserSettings = { ...settings, currentVdot: vdotEstimate };
    const paceZones = deriveRatingPaceZones(settingsWithNewVdot);
    await prisma.userSettings.update({
      where: { id: 1 },
      data: {
        currentVdot: vdotEstimate,
        lastEstimatedVdot: vdotEstimate,
        lastVdotCheckDate: now,
        ...paceZones,
      },
    });
    await prisma.planAdaptation.create({
      data: {
        weekNumber: targetWeekNumber,
        type: "vdot_improved",
        reason: `${name}, your fitness has improved! VDOT updated from ${prior} to ${vdotEstimate}.`,
        changes: JSON.stringify([`Pace targets updated to VDOT ${vdotEstimate} for all unlocked weeks.`]),
      },
    });
  } else {
    await prisma.userSettings.update({
      where: { id: 1 },
      data: {
        lastEstimatedVdot: vdotEstimate,
        lastVdotCheckDate: now,
      },
    });
  }

  if (!ratingRuleApplied && !missedRuleApplied && !vdotShouldUpdate) {
    return { adapted: false, reason: null, changes: [] };
  }

  await saveGeneratedPlan(stored.config, newPlan, stored.lockedWeeks);

  const reason = !ratingRuleApplied && !missedRuleApplied
    ? vdotShouldUpdate
      ? `VDOT updated to ${vdotEstimate}.`
      : null
    : adaptationType === "soft_cutback"
      ? `Runs averaged ${recent5.avg.toFixed(1)}/10 across 5 weeks.`
      : adaptationType === "missed_sessions_warning"
        ? "You missed multiple planned sessions last week."
        : adaptationType === "cutback_inserted"
          ? "You missed multiple planned sessions for two consecutive weeks."
          : adaptationType === "extended_recovery"
            ? "You missed multiple planned sessions for three consecutive weeks."
      : adaptationType === "volume_reduced"
        ? `${name}, your recent runs are averaging ${recent3.avg.toFixed(1)}/10. We've eased next week slightly.`
        : `${name}, you're running strong! We've added a little more volume next week.`;

  if (reason && adaptationType && adaptationType !== "vdot_improved") {
    await prisma.planAdaptation.create({
      data: {
        weekNumber: targetWeekNumber,
        type: adaptationType,
        reason,
        changes: JSON.stringify(changes),
      },
    });
    await prisma.userSettings.update({
      where: { id: 1 },
      data: { lastAdaptationDate: now },
    });
  }

  return { adapted: true, reason, changes };
}
