import type { NextRequest } from "next/server";
import { GROQ_MODEL } from "@/lib/ai";
import { getAvailableVehiclesContext } from "@/lib/chat-context";
import { buildSystemPrompt } from "@/lib/prompts";
import { getVehicles } from "@/lib/queries";
import { ChatRequestSchema } from "@/lib/schemas";
import { createRateLimiter, getVisitorId } from "@/lib/rate-limit";

const PLAIN_TEXT_HEADERS = { "Content-Type": "text/plain; charset=utf-8" };

function textResponse(body: string, status = 200): Response {
  return new Response(body, { status, headers: PLAIN_TEXT_HEADERS });
}

const isRateLimited = createRateLimiter({ name: "chat", limit: 10, windowMs: 60_000 });

// ---------------------------------------------------------------
// Fallback — used only when Groq fails to even start responding. Skips
// the AI entirely and picks real cars straight from the database based on
// a few obvious keywords in the visitor's last message, so the widget
// still has something useful to show instead of an error.
// ---------------------------------------------------------------

async function buildFallbackReply(lastUserMessage: string): Promise<string> {
  const text = lastUserMessage.toLowerCase();

  const wantsCheap = /\b(cheap|budget|affordable|inexpensive)\b/.test(text);
  const wantsLuxury = /\b(luxury|premium|expensive|exclusive|high[- ]end)\b/.test(text);
  const seatsMatch = text.match(/(\d+)\s*(people|person|seats?|passengers?)/);
  const seats = seatsMatch ? Number(seatsMatch[1]) : undefined;
  const wantsElectric = /\belectric\b/.test(text);

  const sortBy = wantsCheap || wantsLuxury ? "price_per_day" : "rating";
  const sortOrder = wantsLuxury ? "desc" : wantsCheap ? "asc" : "desc";

  let { data: matches } = await getVehicles({
    available: true,
    seats,
    fuel: wantsElectric ? "electric" : undefined,
    sortBy,
    sortOrder,
    pageSize: 3,
  });

  // Filters too narrow for the real inventory — fall back to just the
  // best general picks so we still recommend *something*.
  if (matches.length === 0) {
    ({ data: matches } = await getVehicles({ available: true, sortBy, sortOrder, pageSize: 3 }));
  }

  if (matches.length === 0) {
    return "Our assistant is briefly unavailable, and we don't have any cars listed right now. Please check back soon.";
  }

  const list = matches.map((v) => `${v.name} ($${v.price_per_day}/day)`).join(", ");
  const slugs = matches.map((v) => v.slug).join(", ");

  return `Our assistant is briefly unavailable, but here are a few options that might work for you: ${list}.\n\n<recommendations>${slugs}</recommendations>`;
}

// ---------------------------------------------------------------
// Groq streaming — re-emits Groq's SSE token stream as plain text so the
// client doesn't need to know anything about SSE at all.
// ---------------------------------------------------------------

async function streamGroqReply(
  messages: { role: "user" | "assistant"; content: string }[],
  systemPrompt: string
): Promise<ReadableStream<Uint8Array>> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("Missing GROQ_API_KEY environment variable.");

  const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [{ role: "system", content: systemPrompt }, ...messages],
      stream: true,
      // Replies are meant to be under 80 words; the cap (which also counts the model's reasoning) bounds the cost of one request.
      max_tokens: 1024,
    }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!groqResponse.ok || !groqResponse.body) {
    throw new Error(`Groq stream request failed (${groqResponse.status})`);
  }

  const groqBody = groqResponse.body;
  const encoder = new TextEncoder();

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = groqBody.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? ""; // last (possibly incomplete) line stays in the buffer

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data:")) continue;

            const payload = trimmed.slice("data:".length).trim();
            if (payload === "[DONE]") continue;

            try {
              const parsed = JSON.parse(payload);
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) controller.enqueue(encoder.encode(content));
            } catch {
              // Ignore a stray non-JSON SSE line rather than killing the stream.
            }
          }
        }
      } finally {
        controller.close();
      }
    },
  });
}

export async function POST(request: NextRequest) {
  const visitorId = getVisitorId(request);

  if (await isRateLimited(visitorId)) {
    return textResponse(
      "You're sending messages a little quickly. Give it a few seconds and try again!",
      429
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return textResponse("That request didn't look right. Please try sending your message again.", 400);
  }

  const parsed = ChatRequestSchema.safeParse(body);
  if (!parsed.success) {
    return textResponse("That request didn't look right. Please try sending your message again.", 400);
  }

  const { messages } = parsed.data;
  const lastUserMessage = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";

  try {
    const carListText = await getAvailableVehiclesContext();
    const systemPrompt = buildSystemPrompt(carListText);
    const stream = await streamGroqReply(messages, systemPrompt);
    return new Response(stream, { headers: PLAIN_TEXT_HEADERS });
  } catch (error) {
    console.error("Groq chat stream failed, using fallback:", error);
    const fallback = await buildFallbackReply(lastUserMessage);
    return textResponse(fallback);
  }
}
