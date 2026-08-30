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
 * Fires the AI-scored lead's details off to n8n. Never awaited by the
 * caller on the critical path — the lead is already saved by the time this
 * runs, and nothing here is allowed to affect the response sent back to
 * the chat widget.
 */
export function notifyLeadWebhook(lead: Tables<"leads">): void {
  void sendLeadWebhook(lead);
}

async function sendLeadWebhook(lead: Tables<"leads">): Promise<void> {
  const url = process.env.N8N_WEBHOOK_URL;
  if (!url) return;

  try {
    const payload = {
      name: lead.name,
      email: lead.email,
      phone: lead.phone,
      score: lead.score,
      budget_band: lead.budget_band,
      urgency: lead.urgency,
      intent_summary: lead.intent_summary,
      next_action: lead.next_action,
      source: lead.source,
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
