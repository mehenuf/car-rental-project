import { NextRequest, NextResponse } from "next/server";
import { withErrorHandling } from "@/lib/api-response";
import { verifyCronAuth } from "@/lib/cron-auth";
import { runDispatch } from "@/lib/comms/service";
import { paymentsDeps } from "@/lib/payments/deps";
import { releaseDueDeposits } from "@/lib/payments/service";
import { supabaseAdmin } from "@/lib/supabase-server";

/**
 * GET or POST /api/cron/maintenance — scheduled housekeeping, protected by CRON_SECRET:
 *   1. cancels unpaid bookings whose 15 minute hold has expired and frees their cars,
 *   2. releases security deposits once the dispute window after completion has passed,
 *   3. pays out provider earnings that are due (simulated bank transfer),
 *   4. sends queued notifications and applies data retention.
 * Each step is idempotent, so running it twice or late is safe.
 */
async function run(request: NextRequest) {
  verifyCronAuth(request.headers.get("authorization"), process.env.CRON_SECRET);

  const { data: expired, error: expireError } = await supabaseAdmin.rpc("expire_stale_holds");
  if (expireError) throw new Error(`expire_stale_holds: ${expireError.message}`);

  const releasedDeposits = await releaseDueDeposits(paymentsDeps());

  const { data: paidOut, error: payoutError } = await supabaseAdmin.rpc("run_payouts");
  if (payoutError) throw new Error(`run_payouts: ${payoutError.message}`);

  // Licences past their expiry date stop counting (the pickup gate also checks the date itself).
  const { data: expiredLicences, error: licenceError } = await supabaseAdmin.rpc("expire_licences");
  if (licenceError) throw new Error(`expire_licences: ${licenceError.message}`);

  // Reviews whose 14 days have ended appear; unanswered disputes go to a reviewer after 72 hours.
  const { data: published, error: publishError } = await supabaseAdmin.rpc("publish_due_reviews");
  if (publishError) throw new Error(`publish_due_reviews: ${publishError.message}`);
  const { data: escalated, error: escalateError } = await supabaseAdmin.rpc("expire_disputes");
  if (escalateError) throw new Error(`expire_disputes: ${escalateError.message}`);

  // Queue due pickup reminders, then send everything waiting (also retries earlier failures).
  const { data: reminders, error: reminderError } = await supabaseAdmin.rpc("enqueue_due_reminders");
  if (reminderError) throw new Error(`enqueue_due_reminders: ${reminderError.message}`);
  const dispatched = await runDispatch();

  // Licence photos past their keep period: remove the files first, then the rows (apply_retention).
  const { data: staleDocs, error: staleError } = await supabaseAdmin.rpc("expired_driver_documents");
  if (staleError) throw new Error(`expired_driver_documents: ${staleError.message}`);
  if (staleDocs && staleDocs.length > 0) {
    const { error: removeError } = await supabaseAdmin.storage.from("customer-documents").remove(staleDocs.map((d) => d.storage_path));
    if (removeError) throw new Error(`remove documents: ${removeError.message}`);
  }

  // Purge or anonymise data past its retention period (see docs/compliance/record-of-processing.md).
  const { data: retention, error: retentionError } = await supabaseAdmin.rpc("apply_retention");
  if (retentionError) throw new Error(`apply_retention: ${retentionError.message}`);

  return NextResponse.json({
    expired_holds: expired ?? 0,
    released_deposits: releasedDeposits,
    payouts_paid: paidOut ?? 0,
    licences_expired: expiredLicences ?? 0,
    reviews_published: published ?? 0,
    disputes_escalated: escalated ?? 0,
    reminders_queued: reminders ?? 0,
    retention,
    ...dispatched,
  });
}

export const GET = withErrorHandling(run);
export const POST = withErrorHandling(run);
