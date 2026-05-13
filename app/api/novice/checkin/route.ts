import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { enrichNoviceCheckin } from "@/lib/noviceAdaptive";
import { GENERATED_PLAN_ID } from "@/lib/planStorage";
import type { NoviceCheckinSessionType, NoviceSkipReason } from "@/types/novice";

const SKIP: NoviceSkipReason[] = ["illness", "injury", "time", "motivation", "other"];

function isSessionType(x: unknown): x is NoviceCheckinSessionType {
  return x === "easy" || x === "long" || x === "tempo";
}

function parseSkip(x: unknown): NoviceSkipReason | null {
  if (x == null) return null;
  if (typeof x !== "string") return null;
  return SKIP.includes(x as NoviceSkipReason) ? (x as NoviceSkipReason) : null;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const sessionId = typeof body.sessionId === "string" ? body.sessionId : null;
    const weekNumber = typeof body.weekNumber === "number" ? body.weekNumber : Number(body.weekNumber);
    const sessionType = body.sessionType;
    const plannedDistanceKm =
      typeof body.plannedDistanceKm === "number" ? body.plannedDistanceKm : Number(body.plannedDistanceKm);
    const plannedDurationMin =
      typeof body.plannedDurationMin === "number" ? body.plannedDurationMin : Number(body.plannedDurationMin);
    const completed = Boolean(body.completed);
    const userRpe = typeof body.userRpe === "number" ? body.userRpe : Number(body.userRpe);
    const skippedReason = parseSkip(body.skippedReason);

    if (!sessionId || !Number.isFinite(weekNumber) || weekNumber < 1) {
      return NextResponse.json({ error: "invalid_session_or_week" }, { status: 400 });
    }
    if (!isSessionType(sessionType)) {
      return NextResponse.json({ error: "invalid_session_type" }, { status: 400 });
    }
    if (!Number.isFinite(plannedDistanceKm) || !Number.isFinite(plannedDurationMin)) {
      return NextResponse.json({ error: "invalid_planned_metrics" }, { status: 400 });
    }
    if (!Number.isFinite(userRpe) || userRpe < 1 || userRpe > 10) {
      return NextResponse.json({ error: "invalid_rpe" }, { status: 400 });
    }
    if (!completed && skippedReason == null) {
      return NextResponse.json({ error: "skipped_reason_required" }, { status: 400 });
    }
    if (completed && skippedReason != null) {
      return NextResponse.json({ error: "skip_reason_must_be_null_when_completed" }, { status: 400 });
    }

    const profile = await prisma.profile.findUnique({ where: { id: 1 } });
    let ageYears: number | null = null;
    if (profile?.dateOfBirth) {
      const diff = Date.now() - new Date(profile.dateOfBirth).getTime();
      ageYears = Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000));
    }

    const enriched = enrichNoviceCheckin(
      {
        sessionId,
        weekNumber,
        sessionType,
        plannedDistanceKm,
        plannedDurationMin,
        stravaActivityId: typeof body.stravaActivityId === "string" ? body.stravaActivityId : null,
        actualDistanceKm:
          body.actualDistanceKm == null
            ? null
            : typeof body.actualDistanceKm === "number"
              ? body.actualDistanceKm
              : Number(body.actualDistanceKm),
        actualDurationMin:
          body.actualDurationMin == null
            ? null
            : typeof body.actualDurationMin === "number"
              ? body.actualDurationMin
              : Number(body.actualDurationMin),
        averagePaceSecPerKm:
          body.averagePaceSecPerKm == null
            ? null
            : typeof body.averagePaceSecPerKm === "number"
              ? body.averagePaceSecPerKm
              : Number(body.averagePaceSecPerKm),
        averageHeartRate:
          body.averageHeartRate == null
            ? null
            : typeof body.averageHeartRate === "number"
              ? body.averageHeartRate
              : Number(body.averageHeartRate),
        maxHeartRate:
          body.maxHeartRate == null
            ? null
            : typeof body.maxHeartRate === "number"
              ? body.maxHeartRate
              : Number(body.maxHeartRate),
        perceivedEffortFromHr:
          body.perceivedEffortFromHr == null
            ? null
            : typeof body.perceivedEffortFromHr === "number"
              ? body.perceivedEffortFromHr
              : Number(body.perceivedEffortFromHr),
        completed,
        userRpe: Math.round(userRpe),
        skippedReason,
      },
      ageYears,
    );

    const row = await prisma.noviceSessionCheckin.create({
      data: {
        sessionId: enriched.sessionId,
        planId: GENERATED_PLAN_ID,
        weekNumber: enriched.weekNumber,
        sessionType: enriched.sessionType,
        plannedDistanceKm: enriched.plannedDistanceKm,
        plannedDurationMin: enriched.plannedDurationMin,
        stravaActivityId: enriched.stravaActivityId,
        actualDistanceKm: enriched.actualDistanceKm,
        actualDurationMin: enriched.actualDurationMin,
        averagePaceSecPerKm: enriched.averagePaceSecPerKm,
        averageHeartRate: enriched.averageHeartRate,
        maxHeartRate: enriched.maxHeartRate,
        perceivedEffortFromHr: enriched.perceivedEffortFromHr,
        completed: enriched.completed,
        userRpe: enriched.userRpe,
        skippedReason: enriched.skippedReason,
        distanceCompletionRatio: enriched.distanceCompletionRatio,
        effortScore: enriched.effortScore,
      },
    });

    return NextResponse.json({
      ...enriched,
      id: row.id,
      createdAt: row.createdAt.toISOString(),
    });
  } catch (e) {
    console.error("[novice/checkin]", e);
    return NextResponse.json({ error: "checkin_failed" }, { status: 500 });
  }
}
