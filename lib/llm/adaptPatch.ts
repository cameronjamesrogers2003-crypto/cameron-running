import Anthropic from "@anthropic-ai/sdk";
import { validatePatch, type SessionPatch, type GuardrailContext } from "@/lib/adaptation/guardrails";

const SYSTEM_PROMPT = `You are a conservative endurance running coach adapting a Hal Higdon Novice plan for a 22-year-old beginner in Brisbane, training Wed/Sat/Sun only. Propose minimal, safe edits to upcoming sessions. Hard rules: (1) never increase any session >15%, (2) never decrease the long run >25% unless a missed-run pattern justifies it, (3) keep Wed/Sat/Sun day pattern, (4) the long run stays the longest run of the week, (5) if situation is ambiguous set shouldDeferToCoach=true and propose nothing, (6) output must validate against the provided JSON schema — no prose outside it. Brisbane context: dew points >20°C are normal Nov–Mar and are not a fitness regression signal.`;

export interface Tier3Input {
  athleteAge: number;
  planTemplateKey: string;
  recentRatings: { date: string; score: number; sessionType: string }[];
  acwr: number;
  currentWeek: number;
  totalWeeks: number;
  upcomingSessions: {
    id: string;
    date: string;
    sessionType: string;
    distanceKm: number;
    targetPaceLow: number | null;
    targetPaceHigh: number | null;
  }[];
  raceDate: string;
  avgWeatherTempC: number | null;
}

export async function generateAdaptivePatch(
  input: Tier3Input,
  guardrailCtxMap: Map<string, GuardrailContext>
): Promise<SessionPatch[]> {
  if (!process.env.ANTHROPIC_API_KEY) return [];

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  try {
    const response = await client.messages.create(
      {
        model: "claude-sonnet-4-6",
        max_tokens: 2048,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: JSON.stringify(input) }],
        tools: [
          {
            name: "adapt_plan",
            description: "Structured adaptive plan patch output",
            input_schema: {
              type: "object" as const,
              properties: {
                reasoning: { type: "string" },
                confidence: { type: "string", enum: ["high", "medium", "low"] },
                shouldDeferToCoach: { type: "boolean" },
                patches: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      scheduledSessionId: { type: "string" },
                      changes: {
                        type: "object",
                        properties: {
                          distanceKm: { type: "number" },
                          sessionType: { type: "string" },
                          targetPaceMinKmLow: { type: "number" },
                          targetPaceMinKmHigh: { type: "number" },
                          targetHrZone: { type: "integer" },
                          notes: { type: "string" },
                        },
                      },
                      rationale: { type: "string" },
                    },
                    required: ["scheduledSessionId", "changes", "rationale"],
                  },
                },
              },
              required: ["reasoning", "confidence", "shouldDeferToCoach", "patches"],
            },
          },
        ],
        tool_choice: { type: "tool" as const, name: "adapt_plan" },
      },
      { headers: { "anthropic-beta": "structured-outputs-2025-11-13" } }
    );

    const block = response.content.find(
      (c): c is Anthropic.Messages.ToolUseBlock =>
        c.type === "tool_use" && c.name === "adapt_plan"
    );
    if (!block) return [];

    const output = block.input as {
      shouldDeferToCoach: boolean;
      patches: SessionPatch[];
    };

    if (output.shouldDeferToCoach || !output.patches?.length) return [];

    // Validate every patch against guardrails before applying
    return output.patches
      .map(p => {
        const ctx = guardrailCtxMap.get(p.scheduledSessionId);
        if (!ctx) return null;
        return validatePatch(p, ctx).patchAfterGuardrails;
      })
      .filter((p): p is SessionPatch => p !== null);
  } catch (err) {
    console.error("[adaptPatch] Claude error:", err);
    return [];
  }
}
