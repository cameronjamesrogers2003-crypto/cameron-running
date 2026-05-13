import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { GENERATED_PLAN_ID, loadGeneratedPlan } from "@/lib/planStorage";

export const dynamic = "force-dynamic";

/**
 * Strava-linked activities that match a planned Novice session but have no novice check-in yet.
 */
export async function GET() {
  try {
    const stored = await loadGeneratedPlan();
    if (!stored?.plan.length || stored.config.level !== "NOVICE") {
      return NextResponse.json({ matches: [] as PendingMatch[] });
    }

    const sessionIds = new Set<string>();
    const sessionWeek = new Map<string, number>();
    for (const w of stored.plan) {
      for (const s of w.sessions) {
        sessionIds.add(s.id);
        sessionWeek.set(s.id, w.week);
      }
    }

    const existing = await prisma.noviceSessionCheckin.findMany({
      where: { planId: GENERATED_PLAN_ID },
      select: { sessionId: true },
    });
    const checked = new Set(existing.map((r) => r.sessionId));

    const activities = await prisma.activity.findMany({
      where: {
        linkedSessionId: { not: null },
        activityType: { in: ["running", "trail_running"] },
      },
      orderBy: { date: "desc" },
      take: 80,
    });

    const matches: PendingMatch[] = [];
    for (const a of activities) {
      const sid = a.linkedSessionId;
      if (!sid || !sessionIds.has(sid) || checked.has(sid)) continue;
      const weekNumber = sessionWeek.get(sid) ?? 1;
      matches.push({
        sessionId: sid,
        weekNumber,
        activityId: a.id,
        distanceKm: a.distanceKm,
        durationMin: a.durationSecs / 60,
        avgPaceSecPerKm: a.avgPaceSecKm,
        avgHeartRate: a.avgHeartRate,
        date: a.date.toISOString(),
      });
    }

    return NextResponse.json({ matches });
  } catch (e) {
    console.error("[novice/checkin/pending]", e);
    return NextResponse.json({ error: "pending_failed" }, { status: 500 });
  }
}

export type PendingMatch = {
  sessionId: string;
  weekNumber: number;
  activityId: string;
  distanceKm: number;
  durationMin: number;
  avgPaceSecPerKm: number;
  avgHeartRate: number | null;
  date: string;
};
