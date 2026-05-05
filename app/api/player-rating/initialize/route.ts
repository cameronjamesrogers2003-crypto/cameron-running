import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { initializePlayerRating } from "@/lib/playerRating";

export const dynamic = "force-dynamic";

export async function GET() {
  const rating = await initializePlayerRating(prisma);
  return NextResponse.json(rating);
}

export async function POST() {
  return GET();
}
