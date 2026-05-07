import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { syncActivities } from "@/lib/strava";
import { requireInternalApiAuth } from "@/lib/apiAuth";

export async function POST(req: NextRequest) {
  const authResp = requireInternalApiAuth(req);
  if (authResp) return authResp;
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
