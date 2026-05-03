import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const { weightKg } = await req.json();
    if (!weightKg || typeof weightKg !== "number" || weightKg < 30 || weightKg > 200) {
      return NextResponse.json({ error: "Invalid weight" }, { status: 400 });
    }
    const entry = await prisma.weightEntry.create({ data: { weightKg } });
    return NextResponse.json(entry);
  } catch {
    return NextResponse.json({ error: "Failed to save" }, { status: 500 });
  }
}
