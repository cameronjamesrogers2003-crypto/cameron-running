import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { recalculatePlayerRating } from "@/lib/playerRating";
import { requireInternalApiAuth } from "@/lib/apiAuth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  return POST(req);
}

export async function POST(req: NextRequest) {
  const authResp = requireInternalApiAuth(req);
  if (authResp) return authResp;
  try {
    const rating = await recalculatePlayerRating(prisma);
    return NextResponse.json(rating);
  } catch (err) {
    console.error("[player-rating] recalculate failed:", err);
    return NextResponse.json({ error: "Failed to recalculate player rating" }, { status: 500 });
  }
}
