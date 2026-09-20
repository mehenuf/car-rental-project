import "server-only";
import { paymentsDeps } from "@/lib/payments/deps";
import { captureDepositForBooking, refundAmount } from "@/lib/payments/service";
import { supabaseAdmin } from "@/lib/supabase-server";
import { toTrustError } from "@/lib/trust-errors";
import { settleAgreed, type DisputePorts } from "./service";

/** The real database and payment-provider steps behind a dispute resolution. */
export function disputePorts(): DisputePorts {
  return {
    async getDispute(id) {
      const { data, error } = await supabaseAdmin
        .from("disputes")
        .select("id, booking_id, type, status, agreed_amount_minor, offer_minor")
        .eq("id", id)
        .maybeSingle();
      if (error) throw new Error(`getDispute: ${error.message}`);
      return data;
    },
    capture: (bookingId, amountMinor) => captureDepositForBooking(paymentsDeps(), { bookingId, amountMinor }),
    refund: (bookingId, amountMinor, idempotencyKey) => refundAmount(paymentsDeps(), { bookingId, amountMinor, idempotencyKey }),
    async resolve(args) {
      const { error } = await supabaseAdmin.rpc("resolve_dispute", {
        p_dispute_id: args.disputeId,
        p_resolution: args.resolution,
        p_amount: args.amountMinor ?? null,
        p_actor: args.actorUserId,
        p_actor_side: args.actorSide,
        p_note: args.note,
        p_refund_payment_id: args.refundPaymentId ?? null,
      });
      if (error) throw toTrustError(error, "dispute");
    },
  };
}

export interface RespondInput {
  action: "message" | "evidence" | "accept" | "counter" | "contest";
  body?: string;
  amount_minor?: number;
  photo_paths: string[];
}

/** A reply from one side. Accepting an offer also carries out the agreed capture or refund. */
export async function respondToDispute(disputeId: string, side: "customer" | "provider", userId: string, input: RespondInput) {
  const { data, error } = await supabaseAdmin.rpc("respond_dispute", {
    p_dispute_id: disputeId,
    p_side: side,
    p_user: userId,
    p_action: input.action,
    p_body: input.body ?? null,
    p_amount: input.amount_minor ?? null,
    p_photo_paths: input.photo_paths,
  });
  if (error) throw toTrustError(error, "dispute");
  if (input.action === "accept") {
    await settleAgreed(disputePorts(), disputeId, { actorUserId: userId, actorSide: side, note: "Agreed by both sides" });
  }
  return data;
}

/** A dispute with its timeline, for the two parties. Photo paths are returned as-is (never public URLs). */
export async function loadDispute(bookingId: string) {
  const { data: dispute, error } = await supabaseAdmin.from("disputes").select("*").eq("booking_id", bookingId).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (error) throw new Error(`loadDispute: ${error.message}`);
  if (!dispute) return null;
  const { data: events } = await supabaseAdmin
    .from("dispute_events")
    .select("id, actor_side, kind, body, amount_minor, photo_paths, created_at")
    .eq("dispute_id", dispute.id)
    .order("id");
  const { data: inspections } = await supabaseAdmin
    .from("booking_inspections")
    .select("kind, odometer_km, fuel_level, notes, photo_paths, created_at")
    .eq("booking_id", bookingId)
    .order("created_at");
  return { dispute, events: events ?? [], inspections: inspections ?? [] };
}
