import "server-only";

// Server-only: this file reads GROQ_API_KEY / GEMINI_API_KEY, which must
// never ship to the browser. The `server-only` import makes importing it
// from a Client Component a build error, not just a lint warning — the
// same pattern as supabase-server.ts.

export interface AIMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export const GROQ_MODEL = "openai/gpt-oss-120b";
const GEMINI_MODEL = "gemini-2.0-flash";

async function callGroq(messages: AIMessage[]): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("Missing GROQ_API_KEY environment variable.");

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: GROQ_MODEL, messages }),
  });

  if (!res.ok) {
    throw new Error(`Groq request failed (${res.status}): ${await res.text()}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("Groq response had no message content.");
  return content;
}

async function callGemini(messages: AIMessage[]): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("Missing GEMINI_API_KEY environment variable.");

  // Gemini has no "system" role — system messages are merged into a
  // separate systemInstruction field, and "assistant" is spelled "model".
  const systemText = messages
    .filter((m) => m.role === "system")
    .map((m) => m.content)
    .join("\n\n");

  const contents = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents,
        ...(systemText && { systemInstruction: { parts: [{ text: systemText }] } }),
      }),
    }
  );

  if (!res.ok) {
    throw new Error(`Gemini request failed (${res.status}): ${await res.text()}`);
  }

  const data = await res.json();
  const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!content) throw new Error("Gemini response had no content.");
  return content;
}

/**
 * Sends `messages` to Groq; if that throws for any reason (missing key,
 * network error, rate limit, bad response), automatically retries the same
 * conversation against Gemini before giving up.
 */
export async function getAIResponse(messages: AIMessage[]): Promise<string> {
  try {
    return await callGroq(messages);
  } catch (groqError) {
    console.error("Groq request failed, falling back to Gemini:", groqError);
    try {
      return await callGemini(messages);
    } catch (geminiError) {
      console.error("Gemini fallback also failed:", geminiError);
      throw new Error("AI request failed on both Groq and Gemini providers.");
    }
  }
}
