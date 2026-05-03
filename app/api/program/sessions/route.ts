import { NextResponse } from "next/server";
import prisma from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const [sessions, adjustments] = await Promise.all([
    prisma.scheduledSession.findMany({
      orderBy: { date: "asc" },
      include: {
        activity: {
          select: { avgPaceSecKm: true, avgHeartRate: true },
        },
        rating: {
          select: {
            score: true,
            paceScore: true,
            hrScore: true,
            executionScore: true,
          },
        },
      },
    }),
    prisma.planAdjustment.findMany({
      where: { applied: true },
      orderBy: { triggeredAt: "desc" },
      select: { triggerReason: true, patch: true },
    }),
  ]);

  const reasonBySession = new Map<string, string>();
  for (const adj of adjustments) {
    const patch = adj.patch as unknown;
    if (!Array.isArray(patch)) continue;
    for (const item of patch) {
      if (!item || typeof item !== "object") continue;
      const scheduledSessionId = (item as { scheduledSessionId?: unknown }).scheduledSessionId;
      if (typeof scheduledSessionId === "string" && !reasonBySession.has(scheduledSessionId)) {
        reasonBySession.set(scheduledSessionId, adj.triggerReason);
      }
    }
  }

  return NextResponse.json(
    sessions.map((s) => ({
      id: s.id,
      date: s.date.toISOString(),
      status: s.status,
      currentDistanceKm: Number(s.currentDistanceKm),
      originalDistanceKm: Number(s.originalDistanceKm),
      targetPaceMinKmLow: s.targetPaceMinKmLow ? Number(s.targetPaceMinKmLow) : null,
      targetPaceMinKmHigh: s.targetPaceMinKmHigh ? Number(s.targetPaceMinKmHigh) : null,
      targetHrZone: s.targetHrZone,
      isAdjusted: s.isAdjusted,
      rating: s.rating
        ? {
            score: Number(s.rating.score),
            paceScore: Number(s.rating.paceScore),
            hrScore: Number(s.rating.hrScore),
            executionScore: Number(s.rating.executionScore),
          }
        : null,
      activity: s.activity,
      triggerReason: reasonBySession.get(s.id) ?? null,
    }))
  );
}
