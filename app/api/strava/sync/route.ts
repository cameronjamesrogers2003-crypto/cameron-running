import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { syncActivities } from "@/lib/strava";

export async function POST(req: NextRequest) {
  void req;
  try {
    await prisma.profile.update({
      where: { id: 1 },
      data: { lastRefreshedAt: new Date() },
    });
    const result = await syncActivities();
    return NextResponse.json(result);
  } catch (err) {
    console.error("Strava sync error:", err);
    return NextResponse.json({ error: "Sync failed" }, { status: 500 });
  }
}
