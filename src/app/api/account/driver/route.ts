import { NextRequest, NextResponse } from "next/server";
import { withErrorHandling } from "@/lib/api-response";
import { ApiError, ConflictError } from "@/lib/errors";
import { canTransition } from "@/lib/account/licence";
import { DriverProfileInputSchema } from "@/lib/account/schemas";
import { requireUser } from "@/lib/account/session";
import { supabaseAdmin } from "@/lib/supabase-server";

/** GET /api/account/driver — the caller's driver profile and uploaded documents (never the files themselves). */
export const GET = withErrorHandling(async () => {
  const user = await requireUser();
  const [{ data: profile, error }, { data: documents, error: docError }] = await Promise.all([
    supabaseAdmin.from("driver_profiles").select("*").eq("user_id", user.id).maybeSingle(),
    supabaseAdmin
      .from("driver_documents")
      .select("id, kind, mime_type, size_bytes, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
  ]);
  if (error || docError) throw new Error(`driver: ${(error ?? docError)?.message}`);
  return NextResponse.json({ profile: profile ?? null, documents: documents ?? [] });
});

/**
 * PUT /api/account/driver — saves the licence details and submits them for review. A profile under
 * review cannot be edited; a rejected or expired one can be resubmitted. Both sides of the licence
 * must be uploaded first.
 */
export const PUT = withErrorHandling(async (request: NextRequest) => {
  const user = await requireUser();
  const input = DriverProfileInputSchema().parse(await request.json());

  const { data: existing, error } = await supabaseAdmin
    .from("driver_profiles")
    .select("status")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) throw new Error(`driver: ${error.message}`);
  const from = existing?.status ?? "unverified";
  if (!canTransition(from, "pending", "customer")) {
    throw new ConflictError(from === "pending" ? "Your licence is being reviewed." : "Your licence is already verified.");
  }

  const { data: docs, error: docError } = await supabaseAdmin
    .from("driver_documents")
    .select("kind")
    .eq("user_id", user.id);
  if (docError) throw new Error(`driver: ${docError.message}`);
  const kinds = new Set((docs ?? []).map((d) => d.kind));
  if (!kinds.has("licence_front") || !kinds.has("licence_back")) {
    throw new ApiError(400, "Upload photos of the front and back of your licence first.");
  }

  const now = new Date().toISOString();
  const { error: saveError } = await supabaseAdmin.from("driver_profiles").upsert({
    user_id: user.id,
    ...input,
    status: "pending",
    review_note: null,
    submitted_at: now,
    reviewed_at: null,
    reviewed_by: null,
    updated_at: now,
  });
  if (saveError) throw new Error(`driver: ${saveError.message}`);
  return NextResponse.json({ status: "pending" });
});
