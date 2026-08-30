import "server-only";
import { supabaseAdmin } from "@/lib/supabase-server";
import type { Tables } from "@/types/database";

const WEBHOOK_TIMEOUT_MS = 3000;

/**
 * Fires the booking details off to n8n. Never awaited by the caller on
 * the critical path — the booking is already saved by the time this
 * runs, and nothing here is allowed to affect the API response.
 */
export function notifyBookingWebhook(booking: Tables<"bookings">): void {
  void sendBookingWebhook(booking);
}

async function sendBookingWebhook(booking: Tables<"bookings">): Promise<void> {
  const url = process.env.N8N_WEBHOOK_URL;
  if (!url) return;

  try {
    let carName: string | null = null;
    if (booking.vehicle_id) {
      const { data: vehicle } = await supabaseAdmin
        .from("vehicles")
        .select("name")
        .eq("id", booking.vehicle_id)
        .maybeSingle();
      carName = vehicle?.name ?? null;
    }

    const payload = {
      booking_reference: booking.reference,
      customer_name: booking.customer_name,
      email: booking.email,
      car: carName,
      total_price: booking.total_amount,
      lead_score: booking.lead_score ?? null,
    };

    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(WEBHOOK_TIMEOUT_MS),
    });
  } catch (error) {
    console.error("notifyBookingWebhook: request failed", error);
  }
}

/**
 * Fires the AI-scored lead's details off to n8n. Returns a promise so the
 * caller (the /api/chat/score route, itself called without being awaited
 * from the browser) can await it before the serverless function ends —
 * failures still never surface, since `sendLeadWebhook` swallows its own
 * errors below.
 *
 * Field names deliberately mirror the booking webhook's payload (see
 * `sendBookingWebhook`) so the same n8n workflow can handle either kind of
 * event — a chat lead has no reference, customer name, or car, so those
 * are synthesized/stood-in for here. `lead_score` in particular must stay
 * named exactly that: n8n's routing checks that field to decide hot vs
 * cold.
 *
 * `vehicleInterest` is the AI-extracted car model from the scoring pass
 * (see LeadScoreResultSchema in score/route.ts) — used for `vehicle_name`
 * when present, since it's a much better stand-in than the general intent
 * summary. Falls back to the summary when the AI didn't spot one.
 */
export function notifyLeadWebhook(
  lead: Tables<"leads">,
  vehicleInterest?: string | null
): Promise<void> {
  return sendLeadWebhook(lead, vehicleInterest);
}

async function sendLeadWebhook(lead: Tables<"leads">, vehicleInterest?: string | null): Promise<void> {
  const url = process.env.N8N_WEBHOOK_URL;
  if (!url) return;

  try {
    const payload = {
      reference: `LEAD-${lead.id.slice(0, 8)}`,
      customer_name: lead.name ?? "Website visitor",
      email: lead.email ?? "",
      vehicle_name: vehicleInterest ?? lead.intent_summary,
      total_amount: 0,
      lead_score: lead.score,
    };

    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(WEBHOOK_TIMEOUT_MS),
    });
  } catch (error) {
    console.error("notifyLeadWebhook: request failed", error);
  }
}
