import { NextResponse } from "next/server";
import { syncActivities } from "@/lib/strava";

export async function POST() {
  try {
    const result = await syncActivities();
    return NextResponse.json(result);
  } catch (err) {
    console.error("Strava sync error:", err);
    return NextResponse.json({ error: "Sync failed" }, { status: 500 });
  }
}
