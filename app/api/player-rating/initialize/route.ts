import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { initializePlayerRating } from "@/lib/playerRating";

export const dynamic = "force-dynamic";

async function runInitialize() {
  try {
    const rating = await initializePlayerRating(prisma);
    return NextResponse.json(rating);
  } catch (err) {
    console.error("[player-rating] initialize failed:", err);
    return NextResponse.json({ error: "Failed to initialize player rating" }, { status: 500 });
  }
}

export async function GET() {
  return runInitialize();
}

export async function POST() {
  return runInitialize();
}
