import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { computeACWR } from "@/lib/scoring/rTSS";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;

  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  // Mark overdue SCHEDULED sessions as MISSED
  const missed = await prisma.scheduledSession.updateMany({
    where: {
      date: { lt: todayStart },
      status: "SCHEDULED",
    },
    data: { status: "MISSED" },
  });

  // Recompute ACWR/ATL/CTL from all RunRatings with TSS
  const ratings = await prisma.runRating.findMany({
    where: { rTSS: { not: null } },
    orderBy: { createdAt: "asc" },
    select: { rTSS: true, createdAt: true },
  });

  const dailyTSS = ratings
    .filter(r => r.rTSS !== null)
    .map(r => ({ date: r.createdAt, tss: Number(r.rTSS) }));

  const { acwr, atl, ctl } = computeACWR(dailyTSS);

  await prisma.settings.update({
    where: { id: 1 },
    data: {
      lastACWR: acwr,
      lastATL: atl,
      lastCTL: ctl,
      lastMetricsDate: now,
    },
  });

  return NextResponse.json({
    ok: true,
    missedSessions: missed.count,
    acwr: Math.round(acwr * 100) / 100,
    atl: Math.round(atl * 10) / 10,
    ctl: Math.round(ctl * 10) / 10,
  });
}
