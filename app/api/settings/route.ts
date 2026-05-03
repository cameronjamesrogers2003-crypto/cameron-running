import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

export async function GET() {
  try {
    const settings = await prisma.settings.findUnique({ where: { id: 1 } });
    return NextResponse.json(settings ?? {});
  } catch {
    return NextResponse.json({}, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const allowed = ["planStartDate", "halfCompleted", "halfCompletedAt", "activePlan", "goal5kTimeSecs", "comfortableDistKm"];
    const data: Record<string, unknown> = {};

    for (const key of allowed) {
      if (key in body) {
        if (key === "planStartDate" || key === "halfCompletedAt") {
          data[key] = body[key] ? new Date(body[key]) : null;
        } else {
          data[key] = body[key];
        }
      }
    }

    const settings = await prisma.settings.upsert({
      where: { id: 1 },
      update: data,
      create: { id: 1, ...data },
    });
    return NextResponse.json(settings);
  } catch {
    return NextResponse.json({ error: "Failed to save" }, { status: 500 });
  }
}
