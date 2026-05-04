import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { persistActivityRating } from "@/lib/persistActivityRating";

export const dynamic = "force-dynamic";

/** GET/POST — recompute rating + classifiedRunType for every running activity (oldest first for stable medians). */
export async function GET() {
  return POST();
}

export async function POST() {
  const ids = await prisma.activity.findMany({
    where: { activityType: { in: ["running", "trail_running"] } },
    orderBy: { date: "asc" },
    select: { id: true },
  });

  let ok = 0;
  let errors = 0;
  for (const { id } of ids) {
    try {
      await persistActivityRating(prisma, id);
      ok++;
    } catch {
      errors++;
    }
  }

  return NextResponse.json({ updated: ok, errors, total: ids.length });
}
