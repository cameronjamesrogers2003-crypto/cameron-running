import Anthropic from "@anthropic-ai/sdk";
import type { CommentaryContext } from "@/lib/scoring/index";

const SYSTEM_PROMPT = `You are a running coach commenting on a single completed training run. You receive numeric sub-scores and metrics. Write a short, encouraging, factual explanation of WHY the score is what it is. Rules: do NOT recommend plan changes. Do NOT invent metrics not present in the input. Plain English, second person, no jargon beyond "pace", "heart rate", "zone". If heat-adjusted, mention it once.`;

export interface Commentary {
  headline: string;      // max 80 chars
  explanation: string;   // max 300 chars
  confidence: "high" | "medium" | "low";
}

export async function generateCommentary(
  ctx: CommentaryContext
): Promise<Commentary | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  try {
    const response = await client.messages.create(
      {
        model: "claude-sonnet-4-6",
        max_tokens: 512,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: JSON.stringify(ctx) }],
        tools: [
          {
            name: "run_commentary",
            description: "Structured run commentary output",
            input_schema: {
              type: "object" as const,
              properties: {
                headline: { type: "string" },
                explanation: { type: "string" },
                confidence: { type: "string", enum: ["high", "medium", "low"] },
              },
              required: ["headline", "explanation", "confidence"],
            },
          },
        ],
        tool_choice: { type: "tool" as const, name: "run_commentary" },
      },
      { headers: { "anthropic-beta": "structured-outputs-2025-11-13" } }
    );

    const block = response.content.find(
      (c): c is Anthropic.Messages.ToolUseBlock =>
        c.type === "tool_use" && c.name === "run_commentary"
    );
    if (!block) return null;

    return block.input as Commentary;
  } catch (err) {
    console.error("[commentary] Claude error:", err);
    return null;
  }
}
