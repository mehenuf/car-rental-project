import { NextRequest, NextResponse } from "next/server";
import { withErrorHandling } from "@/lib/api-response";
import { runDispatch } from "@/lib/comms/service";
import { verifyCronAuth } from "@/lib/cron-auth";
import { supabaseAdmin } from "@/lib/supabase-server";

/**
 * GET or POST /api/cron/dispatch, protected by CRON_SECRET. Queues pickup reminders that are due,
 * then runs one dispatcher pass, which also retries earlier failures. Notifications are normally
 * sent right after the request that caused them, so correctness never depends on how often this
 * runs (once a day on Vercel Hobby, every five minutes on a paid plan).
 */
async function run(request: NextRequest) {
  verifyCronAuth(request.headers.get("authorization"), process.env.CRON_SECRET);

  const { data: reminders, error } = await supabaseAdmin.rpc("enqueue_due_reminders");
  if (error) throw new Error(`enqueue_due_reminders: ${error.message}`);

  const result = await runDispatch();
  return NextResponse.json({ reminders_queued: reminders ?? 0, ...result });
}

export const GET = withErrorHandling(run);
export const POST = withErrorHandling(run);
