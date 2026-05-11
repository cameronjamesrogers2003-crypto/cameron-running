import { NextResponse } from "next/server";
import prisma from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const activities = await prisma.activity.findMany({
      where: {
        isConfirmed: false,
        activityType: { in: ["running", "trail_running"] },
      },
      orderBy: { date: "desc" },
      select: { id: true },
    });

    return NextResponse.json({
      unconfirmedIds: activities.map((a) => a.id),
    });
  } catch (error) {
    console.error("[api/runs/unconfirmed] Error:", error);
    return NextResponse.json({ unconfirmedIds: [] });
  }
}
