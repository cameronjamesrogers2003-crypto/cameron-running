import { NextResponse } from "next/server";
import { backfillRunRatings } from "@/lib/ratingsBackfill";

export const dynamic = "force-dynamic";

export async function POST() {
  const summary = await backfillRunRatings();
  return NextResponse.json(summary);
}
