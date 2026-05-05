import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { recalculatePlayerRating } from "@/lib/playerRating";

export const dynamic = "force-dynamic";

export async function GET() {
  return POST();
}

export async function POST() {
  try {
    const rating = await recalculatePlayerRating(prisma);
    return NextResponse.json(rating);
  } catch (err) {
    console.error("[player-rating] recalculate failed:", err);
    return NextResponse.json({ error: "Failed to recalculate player rating" }, { status: 500 });
  }
}
