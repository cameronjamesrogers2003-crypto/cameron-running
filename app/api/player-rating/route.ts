import { NextResponse } from "next/server";
import prisma from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const rating = await prisma.playerRating.findFirst({
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json(rating);
}
