import "server-only";
import { supabaseAdmin } from "@/lib/supabase-server";
import type { MessagingDeps } from "./messaging";

export function messagingDeps(): MessagingDeps {
  return {
    async getBooking(id) {
      const { data, error } = await supabaseAdmin
        .from("bookings")
        .select("id, user_id, provider_id, payment_status, status")
        .eq("id", id)
        .maybeSingle();
      if (error) throw new Error(`messaging booking: ${error.message}`);
      return data;
    },
    async isProviderMember(providerId, userId) {
      const { data } = await supabaseAdmin
        .from("provider_members")
        .select("user_id")
        .eq("provider_id", providerId)
        .eq("user_id", userId)
        .maybeSingle();
      return Boolean(data);
    },
    async ensureThread(booking) {
      const { data: existing } = await supabaseAdmin.from("message_threads").select("id").eq("booking_id", booking.id).maybeSingle();
      if (existing) return existing.id;
      const { data, error } = await supabaseAdmin
        .from("message_threads")
        .insert({ booking_id: booking.id, customer_user_id: booking.user_id, provider_id: booking.provider_id! })
        .select("id")
        .single();
      if (error) {
        // A concurrent first message created it between our read and insert.
        const { data: again } = await supabaseAdmin.from("message_threads").select("id").eq("booking_id", booking.id).maybeSingle();
        if (again) return again.id;
        throw new Error(`ensureThread: ${error.message}`);
      }
      return data.id;
    },
    async insertMessage(m) {
      const { error } = await supabaseAdmin.from("messages").insert(m);
      if (error) throw new Error(`insertMessage: ${error.message}`);
    },
  };
}

/** Messages on a booking's thread, oldest first. Marks the other side's messages as read for `viewer`. */
export async function loadThread(bookingId: string, viewer: "customer" | "provider") {
  const { data: thread } = await supabaseAdmin.from("message_threads").select("id").eq("booking_id", bookingId).maybeSingle();
  if (!thread) return [];
  const { data, error } = await supabaseAdmin
    .from("messages")
    .select("id, sender_side, body, created_at, read_at")
    .eq("thread_id", thread.id)
    .order("created_at", { ascending: true })
    .limit(200);
  if (error) throw new Error(`loadThread: ${error.message}`);
  const other: ("customer" | "provider" | "platform")[] = viewer === "customer" ? ["provider", "platform"] : ["customer", "platform"];
  await supabaseAdmin
    .from("messages")
    .update({ read_at: new Date().toISOString() })
    .eq("thread_id", thread.id)
    .in("sender_side", other)
    .is("read_at", null);
  return data ?? [];
}
