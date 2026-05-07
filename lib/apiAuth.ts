import { NextRequest, NextResponse } from "next/server";

export function requireInternalApiAuth(req: NextRequest): NextResponse | null {
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
