import type { NextRequest } from "next/server";
import { z } from "zod";
import { getAIResponse, type AIMessage } from "@/lib/ai";
import { buildLeadScoringPrompt } from "@/lib/prompts";
import { createLead } from "@/lib/queries";
import { ChatRequestSchema } from "@/lib/schemas";

/**
 * The AI's analyst reply, validated before anything gets saved. Field names
 * and enum values match the `leads` table's columns exactly (see
 * schema.sql) so a valid result can be inserted as-is.
 */
const LeadScoreResultSchema = z.object({
  score: z.number().int().min(0).max(100),
  budget: z.enum(["low", "mid", "high", "unknown"]),
  urgency: z.enum(["immediate", "this_week", "browsing", "unknown"]),
  summary: z.string().trim().min(1),
  next_step: z.string().trim().min(1),
});

function formatTranscript(messages: { role: string; content: string }[]): string {
  return messages.map((m) => `${m.role}: ${m.content}`).join("\n");
}

/** Models sometimes wrap JSON in ```json fences despite being told not to. */
function tryExtractJson(raw: string): unknown {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const candidate = (fenced ? fenced[1] : raw).trim();
  try {
    return JSON.parse(candidate);
  } catch {
    return undefined;
  }
}

const NO_CONTENT = new Response(null, { status: 204 });

/**
 * Fire-and-forget: the chat widget calls this in the background and never
 * looks at the response. Nothing in here is allowed to surface as an error
 * to the visitor, so the whole body is one big try/catch that only ever
 * logs and returns 204 — this must never be able to disrupt the actual
 * chat conversation.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = ChatRequestSchema.safeParse(body);
    if (!parsed.success) return NO_CONTENT;

    const { messages } = parsed.data;
    if (messages.length < 3) return NO_CONTENT;

    const baseMessages: AIMessage[] = [
      { role: "system", content: buildLeadScoringPrompt() },
      { role: "user", content: `Conversation:\n${formatTranscript(messages)}` },
    ];

    let raw = await getAIResponse(baseMessages);
    let result = LeadScoreResultSchema.safeParse(tryExtractJson(raw));

    if (!result.success) {
      // Ask once more, showing it exactly what went wrong.
      const retryMessages: AIMessage[] = [
        ...baseMessages,
        { role: "assistant", content: raw },
        {
          role: "user",
          content:
            "That reply didn't match the required format. Reply again with ONLY a valid JSON object containing exactly: score (whole number 0-100), budget (low/mid/high/unknown), urgency (immediate/this_week/browsing/unknown), summary (one sentence), next_step (one sentence). No extra text.",
        },
      ];
      raw = await getAIResponse(retryMessages);
      result = LeadScoreResultSchema.safeParse(tryExtractJson(raw));
    }

    if (!result.success) {
      console.error("Lead scoring: AI reply never matched the expected format.", result.error);
      return NO_CONTENT;
    }

    await createLead({
      score: result.data.score,
      budget_band: result.data.budget,
      urgency: result.data.urgency,
      intent_summary: result.data.summary,
      next_action: result.data.next_step,
      transcript: messages,
      source: "chat",
    });

    return NO_CONTENT;
  } catch (error) {
    console.error("Lead scoring failed:", error);
    return NO_CONTENT;
  }
}
