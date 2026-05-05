import { NextRequest, NextResponse } from "next/server";
import { syncActivities } from "@/lib/strava";

function getVerifyToken(): string | null {
  if (process.env.STRAVA_WEBHOOK_VERIFY_TOKEN) {
    return process.env.STRAVA_WEBHOOK_VERIFY_TOKEN;
  }

  return process.env.NODE_ENV === "development" ? "dev-verify-token" : null;
}

// Strava subscription verification handshake
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");
  const verifyToken = getVerifyToken();

  if (!verifyToken) {
    console.error("[strava webhook] Missing STRAVA_WEBHOOK_VERIFY_TOKEN");
    return NextResponse.json({ error: "server_not_configured" }, { status: 500 });
  }

  if (mode === "subscribe" && token === verifyToken && challenge) {
    return NextResponse.json({ "hub.challenge": challenge });
  }

  return NextResponse.json({ error: "forbidden" }, { status: 403 });
}

// Incoming Strava webhook event
export async function POST(req: NextRequest) {
  let body: {
    object_type?: string;
    aspect_type?: string;
    object_id?: number;
    owner_id?: number;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  // Fire sync in background for new activity events
  if (body.object_type === "activity" && body.aspect_type === "create" && body.object_id) {
    syncActivities().catch((err) =>
      console.error("[strava webhook] sync failed:", err)
    );
  }

  // Always return 200 immediately — Strava requires < 2s response
  return NextResponse.json({ received: true });
}
