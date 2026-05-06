import { NextRequest, NextResponse } from "next/server";
import { generatePlan } from "@/lib/generatePlan";
import { saveGeneratedPlan } from "@/lib/planStorage";
import type { Day, PlanConfig, RunType } from "@/data/trainingPlan";

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

function isDay(x: unknown): x is Day {
  return x === "mon" || x === "tue" || x === "wed" || x === "thu" || x === "fri" || x === "sat" || x === "sun";
}

function isRunType(x: unknown): x is RunType {
  return x === "easy" || x === "tempo" || x === "interval" || x === "long";
}

function parseConfig(body: unknown): PlanConfig | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;

  const level = b.level;
  const goal = b.goal;
  const weeks = b.weeks;
  const days = b.days;
  const sessionAssignment = b.sessionAssignment;
  const vdot = b.vdot;

  if (level !== "BEGINNER" && level !== "INTERMEDIATE" && level !== "ADVANCED") return null;
  if (goal !== "hm" && goal !== "full") return null;
  if (weeks !== 12 && weeks !== 16 && weeks !== 20) return null;
  if (typeof vdot !== "number" || !Number.isFinite(vdot)) return null;
  if (!Array.isArray(days) || days.length < 2 || days.length > 7 || !days.every(isDay)) return null;
  if (!sessionAssignment || typeof sessionAssignment !== "object") return null;

  const assignment: Partial<Record<Day, RunType>> = {};
  for (const [k, v] of Object.entries(sessionAssignment as Record<string, unknown>)) {
    if (isDay(k) && isRunType(v)) assignment[k] = v;
  }

  return {
    level,
    goal,
    weeks,
    days: days as Day[],
    sessionAssignment: assignment as Record<Day, RunType>,
    vdot,
  };
}

export async function POST(req: NextRequest) {
  const authResp = requirePlansAuth(req);
  if (authResp) return authResp;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const config = parseConfig(body);
  if (!config) return NextResponse.json({ error: "invalid_config" }, { status: 400 });

  const plan = generatePlan(config);
  await saveGeneratedPlan(config, plan);

  return NextResponse.json(plan);
}

