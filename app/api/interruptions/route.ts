import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { requireInternalApiAuth } from "@/lib/apiAuth";

export async function GET() {
  try {
    const rows = await prisma.planInterruption.findMany({
      orderBy: { startDate: "desc" },
    });
    return NextResponse.json(rows);
  } catch (err) {
    console.error("[interruptions] fetch failed:", err);
    return NextResponse.json({ error: "Failed to fetch interruptions" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const authResp = requireInternalApiAuth(req);
  if (authResp) return authResp;
  try {
    const body = await req.json();
    const { reason, type, startDate, endDate, weeklyKmEstimate, notes, weeksAffected } = body;

    if (!reason || !type || !startDate) {
      return NextResponse.json({ error: "reason, type, startDate required" }, { status: 400 });
    }

    const row = await prisma.planInterruption.create({
      data: {
        reason,
        type,
        startDate:        new Date(startDate),
        endDate:          endDate ? new Date(endDate) : null,
        weeklyKmEstimate: weeklyKmEstimate != null ? Number(weeklyKmEstimate) : null,
        notes:            notes || null,
        weeksAffected:    weeksAffected != null ? parseInt(String(weeksAffected), 10) : null,
      },
    });

    return NextResponse.json(row, { status: 201 });
  } catch (err) {
    console.error("[interruptions] create failed:", err);
    return NextResponse.json({ error: "Failed to create interruption" }, { status: 500 });
  }
}
