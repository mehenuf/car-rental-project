# Chat assistant and lead automation

## The chat assistant

The chat widget appears on every page of the customer site. It answers questions about the fleet in plain language, and when it has a specific recommendation, it shows picture cards for up to three real cars that link straight to their detail pages.

**Staying grounded in real inventory.** Before every reply, the server pulls the current list of available vehicles straight from the database and drops it into the system prompt as the assistant's only source of truth. The prompt tells the model never to invent a car, price, or feature that is not in that list, and to say so honestly and suggest the closest real alternative if nothing matches what the customer wants. Recommendations are only ever real vehicle slugs pulled from that same list, not text the model made up on its own.

**What happens if a provider is rate-limited.** Every AI call tries Groq first. If that call fails for any reason, including a rate limit, `getAIResponse` automatically retries the same conversation against Gemini before giving up. For the visible chat specifically, there is a second layer under that one. If Groq fails to even start streaming a reply, the chat route skips AI entirely and falls back to a small keyword-matching function. That function checks the message for words like "cheap," "luxury," a seat count, or "electric," and returns a few real matching cars from the database, so the visitor still gets something useful instead of an error message. Separately, the chat endpoint also rate-limits the visitor's own requests, capped at 10 per minute per IP address, which stops someone from hammering the endpoint. That limit has nothing to do with Groq's or Gemini's own rate limits.

**Lead scoring.** Once a conversation reaches three messages, the widget fires a second, invisible request to `/api/chat/score` in the background. A different system prompt asks the model to act as a sales analyst reading the finished conversation, rather than replying to the customer, and to return a strict JSON object: a score from 0 to 100, a budget band, an urgency level, a one-sentence summary, a suggested next step, and, only when needed, the customer's name, email, and the specific vehicle they seem interested in. If the visitor is logged in, their real name and email from their session are used directly, and the model is not even asked to guess them. If the model's reply does not parse as valid JSON, it is asked once more, and shown exactly what went wrong. If it still does not parse, the whole thing is silently dropped and logged on the server rather than shown to the user. A successful result is saved to the `leads` table and is immediately visible on the admin dashboard: the "Lead Quality" panel on the main dashboard, and a full sortable list at `/admin/leads`, both ordered by score so the highest-intent conversations surface first.

## The n8n lead automation

Only one automation is actually built and working right now: the one described below, triggered by a scored lead. The app also fires a webhook to the same URL when a booking is created (see section 7), but there's currently no n8n workflow behind that event; it's a leftover hook for a second automation that hasn't been built yet.

**What triggers it.** A chat conversation getting scored as a lead (`POST /api/chat/score`) fires a webhook to n8n. This call is fire-and-forget from the app's side. A failure to reach n8n is logged and swallowed, and it never affects whether the lead itself gets saved to the database.

**What the workflow does.** n8n receives the webhook, checks the `lead_score` field to route the event as a hot or cold lead, and appends a row to a Google Sheet recording the customer's name, email, the car or intent involved, the amount, and the score.

**Exported workflow.** [automation/n8n-workflow.json](../automation/n8n-workflow.json)

**Execution screenshots.**

**A successful execution triggered by a scored lead, routed as "hot"**

![Automation: hot lead execution](screenshots/automation-hot-lead-execution.png)

**A successful execution triggered by a scored lead, routed as "cold"**

![Automation: cold lead execution](screenshots/automation-cold-lead-execution.png)

**The resulting rows in the Google Sheet**

![Automation: Google Sheet rows](screenshots/automation-google-sheet-rows.png)

