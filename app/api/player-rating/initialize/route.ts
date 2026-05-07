import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { initializePlayerRating } from "@/lib/playerRating";
import { requireInternalApiAuth } from "@/lib/apiAuth";

export const dynamic = "force-dynamic";

async function runInitialize(req: NextRequest) {
  const authResp = requireInternalApiAuth(req);
  if (authResp) return authResp;
  try {
    const rating = await initializePlayerRating(prisma);
    return NextResponse.json(rating);
  } catch (err) {
    console.error("[player-rating] initialize failed:", err);
    return NextResponse.json({ error: "Failed to initialize player rating" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return runInitialize(req);
}

export async function POST(req: NextRequest) {
  return runInitialize(req);
}
