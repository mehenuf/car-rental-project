import { NextResponse } from "next/server";
import { withErrorHandling } from "@/lib/api-response";
import { requireProviderAccess } from "@/lib/provider/context";
import { supabaseAdmin } from "@/lib/supabase-server";

/** GET /api/provider/payouts — earnings waiting to be paid and already paid out, with the booking each comes from. */
export const GET = withErrorHandling(async () => {
  const { providerId, membership } = await requireProviderAccess("payouts.read");

  const [payouts, account] = await Promise.all([
    supabaseAdmin
      .from("payouts")
      .select("id, booking_id, amount_minor, currency, status, release_after, paid_at, created_at")
      .eq("provider_id", providerId)
      .order("created_at", { ascending: false })
      .limit(200),
    supabaseAdmin.from("payout_accounts").select("account_last4, bank_name").eq("provider_id", providerId).maybeSingle(),
  ]);
  if (payouts.error) throw new Error(`payouts: ${payouts.error.message}`);

  const bookingIds = (payouts.data ?? []).map((p) => p.booking_id);
  const { data: bookings } = bookingIds.length
    ? await supabaseAdmin.from("bookings").select("id, reference, customer_name").in("id", bookingIds)
    : { data: [] };
  const refs = new Map((bookings ?? []).map((b) => [b.id, b]));

  const rows = (payouts.data ?? []).map((p) => ({
    ...p,
    reference: refs.get(p.booking_id)?.reference ?? null,
    customer_name: refs.get(p.booking_id)?.customer_name ?? null,
  }));
  const sum = (status: string) => rows.filter((r) => r.status === status).reduce((total, r) => total + r.amount_minor, 0);

  return NextResponse.json({
    currency: membership.provider.defaultCurrency,
    pending_minor: sum("pending") + sum("frozen"),
    paid_minor: sum("paid"),
    account: account.data ?? null,
    data: rows,
  });
});
