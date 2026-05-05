import { NextRequest, NextResponse } from "next/server";
import { exchangeStravaCode } from "@/lib/strava";
import prisma from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");
  const scope = searchParams.get("scope");

  console.log("[strava/callback] received", { error, hasCode: !!code, scope });

  if (error || !code) {
    const errorId = crypto.randomUUID();
    const reason = error ?? "no_code";
    console.error("[strava/callback] denied_or_missing_code", {
      errorId,
      reason,
      error,
      hasCode: !!code,
      scope,
    });
    return NextResponse.redirect(
      new URL(`/?error=strava_denied&id=${encodeURIComponent(errorId)}`, req.url)
    );
  }

  try {
    console.log("[strava/callback] attempting token exchange...");
    const tokens = await exchangeStravaCode(code);
    console.log("[strava/callback] token exchange succeeded, expires_at:", tokens.expires_at);

    const expiry = new Date(tokens.expires_at * 1000);

    await prisma.profile.upsert({
      where: { id: 1 },
      update: {
        stravaConnected: true,
        stravaToken: tokens.access_token,
        stravaRefresh: tokens.refresh_token,
        stravaTokenExpiry: expiry,
      },
      create: {
        id: 1,
        name: "Cameron",
        dateOfBirth: new Date("2002-08-16"),
        heightCm: 174,
        stravaConnected: true,
        stravaToken: tokens.access_token,
        stravaRefresh: tokens.refresh_token,
        stravaTokenExpiry: expiry,
      },
    });

    console.log("[strava/callback] profile saved — Strava connected");
    return NextResponse.redirect(new URL("/?synced=1", req.url));
  } catch (err) {
    const errorId = crypto.randomUUID();
    const errorObj = err instanceof Error ? err : new Error(String(err));
    console.error("[strava/callback] auth_failed", {
      errorId,
      name: errorObj.name,
      message: errorObj.message,
      stack: errorObj.stack,
    });
    return NextResponse.redirect(
      new URL(`/?error=auth_failed&id=${encodeURIComponent(errorId)}`, req.url)
    );
  }
}
