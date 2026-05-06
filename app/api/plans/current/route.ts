import { NextRequest, NextResponse } from "next/server";
import { loadGeneratedPlan } from "@/lib/planStorage";

function requirePlansAuth(req: NextRequest): NextResponse | null {
  const token = process.env.PLANS_API_TOKEN;
  if (!token) {
    return NextResponse.json({ error: "auth_not_configured" }, { status: 500 });
  }
  const auth = req.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${token}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return null;
}

export async function GET(req: NextRequest) {
  const authErr = requirePlansAuth(req);
  if (authErr) return authErr;

  try {
    const stored = await loadGeneratedPlan();
    return NextResponse.json(stored);
  } catch (err) {
    console.error("[plans/current] load failed:", err);
    return NextResponse.json({ error: "Failed to load stored plan" }, { status: 500 });
  }
}

