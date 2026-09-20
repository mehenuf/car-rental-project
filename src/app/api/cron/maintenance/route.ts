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
 *   3. pays out provider earnings that are due (simulated bank transfer).
 * Each step is idempotent, so running it twice or late is safe.
 */
async function run(request: NextRequest) {
  verifyCronAuth(request.headers.get("authorization"), process.env.CRON_SECRET);

  const { data: expired, error: expireError } = await supabaseAdmin.rpc("expire_stale_holds");
  if (expireError) throw new Error(`expire_stale_holds: ${expireError.message}`);

  const releasedDeposits = await releaseDueDeposits(paymentsDeps());

  const { data: paidOut, error: payoutError } = await supabaseAdmin.rpc("run_payouts");
  if (payoutError) throw new Error(`run_payouts: ${payoutError.message}`);

  // Queue due pickup reminders, then send everything waiting (also retries earlier failures).
  const { data: reminders, error: reminderError } = await supabaseAdmin.rpc("enqueue_due_reminders");
  if (reminderError) throw new Error(`enqueue_due_reminders: ${reminderError.message}`);
  const dispatched = await runDispatch();

  return NextResponse.json({
    expired_holds: expired ?? 0,
    released_deposits: releasedDeposits,
    payouts_paid: paidOut ?? 0,
    reminders_queued: reminders ?? 0,
    ...dispatched,
  });
}

export const GET = withErrorHandling(run);
export const POST = withErrorHandling(run);
