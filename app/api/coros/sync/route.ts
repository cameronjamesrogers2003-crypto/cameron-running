import { NextRequest, NextResponse } from "next/server";

// Migrated to Strava — redirect to new endpoint
export async function POST(req: NextRequest) {
  return NextResponse.redirect(new URL("/api/strava/sync", req.url), 307);
}
