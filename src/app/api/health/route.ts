import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

/**
 * GET /api/health — a liveness and database check for uptime monitors. It reveals nothing but the status,
 * so it is safe to expose. Returns 503 when the database cannot be reached.
 */
export async function GET() {
  const started = Date.now();
  const { error } = await supabaseAdmin.from("platform_settings").select("id").limit(1);
  const ok = !error;
  return NextResponse.json(
    { status: ok ? "ok" : "degraded", database: ok ? "up" : "down", latencyMs: Date.now() - started },
    { status: ok ? 200 : 503, headers: { "Cache-Control": "no-store" } }
  );
}
