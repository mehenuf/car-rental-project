import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { withErrorHandling } from "@/lib/api-response";
import { ApiError, ConflictError, RateLimitError } from "@/lib/errors";
import { ACTIVE_PROVIDER_COOKIE, currentUser } from "@/lib/provider/context";
import { ApplySchema } from "@/lib/provider/schemas";
import { createRateLimiter, getVisitorId } from "@/lib/rate-limit";
import { supabaseAdmin } from "@/lib/supabase-server";

const isRateLimited = createRateLimiter({ limit: 3, windowMs: 60_000 });
const MAX_OWNED_PROVIDERS = 3;

/**
 * POST /api/provider/apply — a signed-in customer starts a provider account
 * (company or private individual). Creates the provider in `draft`, makes the
 * caller its owner, and creates its first branch with the address kept private.
 */
export const POST = withErrorHandling(async (request: NextRequest) => {
  if (isRateLimited(getVisitorId(request))) throw new RateLimitError();

  const user = await currentUser();
  if (!user) throw new ApiError(401, "Please sign in to apply.");

  const input = ApplySchema.parse(await request.json());

  const { count, error: countError } = await supabaseAdmin
    .from("provider_members")
    .select("provider_id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("role", "owner");
  if (countError) throw new Error(`apply: ${countError.message}`);
  if ((count ?? 0) >= MAX_OWNED_PROVIDERS) {
    throw new ConflictError(`You can own at most ${MAX_OWNED_PROVIDERS} provider accounts.`);
  }

  const { data: provider, error: providerError } = await supabaseAdmin
    .from("providers")
    .insert({
      type: input.type,
      legal_name: input.legal_name,
      display_name: input.display_name,
      country_code: input.country_code,
      default_currency: input.currency,
      registration_number: input.registration_number ?? null,
      contact_phone: input.contact_phone,
      status: "draft",
    })
    .select("id")
    .single();
  if (providerError) throw new Error(`apply: ${providerError.message}`);

  // Several rows are created; if any step fails, delete the provider (everything cascades) so no half-built account is left behind.
  try {
    const { error: memberError } = await supabaseAdmin
      .from("provider_members")
      .insert({ provider_id: provider.id, user_id: user.id, role: "owner" });
    if (memberError) throw new Error(memberError.message);

    const country = new Intl.DisplayNames(["en"], { type: "region" }).of(input.country_code) ?? input.country_code;
    const { data: branch, error: branchError } = await supabaseAdmin
      .from("branches")
      .insert({
        provider_id: provider.id,
        code: `${input.country_code}-1`,
        name: input.branch.name,
        city: input.branch.city,
        country,
        country_code: input.country_code,
        currency: input.currency,
        timezone: input.branch.timezone,
      })
      .select("id")
      .single();
    if (branchError) throw new Error(branchError.message);

    const { error: privateError } = await supabaseAdmin
      .from("branch_private")
      .insert({ branch_id: branch.id, provider_id: provider.id, address: input.branch.address });
    if (privateError) throw new Error(privateError.message);
  } catch (err) {
    await supabaseAdmin.from("providers").delete().eq("id", provider.id);
    throw new Error(`apply: ${err instanceof Error ? err.message : "failed"}`);
  }

  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_PROVIDER_COOKIE, provider.id, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 90 });
  return NextResponse.json({ provider_id: provider.id, status: "draft" }, { status: 201 });
});
