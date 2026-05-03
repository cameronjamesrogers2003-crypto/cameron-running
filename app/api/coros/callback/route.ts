import { NextRequest, NextResponse } from "next/server";

// Migrated to Strava — redirect to new endpoint
export async function GET(req: NextRequest) {
  return NextResponse.redirect(new URL("/api/strava/callback?" + req.nextUrl.searchParams, req.url));
}
