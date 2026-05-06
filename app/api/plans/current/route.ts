import { NextResponse } from "next/server";
import { loadGeneratedPlan } from "@/lib/planStorage";

export async function GET() {
  try {
    const stored = await loadGeneratedPlan();
    return NextResponse.json(stored);
  } catch (err) {
    console.error("[plans/current] load failed:", err);
    return NextResponse.json({ error: "Failed to load stored plan" }, { status: 500 });
  }
}

