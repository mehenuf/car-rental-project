import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { ApiError } from "@/lib/errors";
import { can, type ProviderAction, type ProviderRole } from "@/lib/provider/permissions";
import { supabaseAdmin } from "@/lib/supabase-server";
import type { ProviderStatus, ProviderType } from "@/types/database";

export const ACTIVE_PROVIDER_COOKIE = "bc_provider";

export interface Membership {
  providerId: string;
  role: ProviderRole;
  /** Set for a branch-scoped manager; null means all branches. */
  branchId: number | null;
  provider: {
    id: string;
    type: ProviderType;
    displayName: string;
    status: ProviderStatus;
    defaultCurrency: string;
    countryCode: string;
  };
}

export interface ProviderContext {
  userId: string;
  email: string | null;
  memberships: Membership[];
  active: Membership | null;
}

export async function currentUser(): Promise<{ id: string; email: string | null } | null> {
  const cookieStore = await cookies();
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
      },
    },
  });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ? { id: user.id, email: user.email ?? null } : null;
}

/**
 * The signed-in user's provider memberships (read with the service role, so
 * this is the server's own view, never the client's claim) and the active
 * one. The active provider comes from a cookie but is only honoured if the
 * user really is a member of it.
 */
export async function getProviderContext(): Promise<ProviderContext | null> {
  const user = await currentUser();
  if (!user) return null;

  const { data, error } = await supabaseAdmin
    .from("provider_members")
    .select("provider_id, role, branch_id")
    .eq("user_id", user.id);
  if (error) throw new Error(`getProviderContext: ${error.message}`);

  const providerIds = (data ?? []).map((m) => m.provider_id);
  const { data: providers, error: providerError } = providerIds.length
    ? await supabaseAdmin
        .from("providers")
        .select("id, type, display_name, status, default_currency, country_code")
        .in("id", providerIds)
    : { data: [], error: null };
  if (providerError) throw new Error(`getProviderContext: ${providerError.message}`);

  const memberships: Membership[] = (data ?? []).flatMap((m) => {
    const provider = providers?.find((p) => p.id === m.provider_id);
    return provider
      ? [
          {
            providerId: m.provider_id,
            role: m.role,
            branchId: m.branch_id,
            provider: {
              id: provider.id,
              type: provider.type,
              displayName: provider.display_name,
              status: provider.status,
              defaultCurrency: provider.default_currency,
              countryCode: provider.country_code,
            },
          },
        ]
      : [];
  });

  const cookieStore = await cookies();
  const wanted = cookieStore.get(ACTIVE_PROVIDER_COOKIE)?.value;
  const active = memberships.find((m) => m.providerId === wanted) ?? memberships[0] ?? null;
  return { userId: user.id, email: user.email, memberships, active };
}

export interface ProviderAccess {
  userId: string;
  email: string | null;
  membership: Membership;
  providerId: string;
}

/**
 * Guards a provider API route. Throws 401 when signed out, 403 when the caller
 * has no active provider, lacks the role for `action`, or (when
 * `requireApproved`) the provider is not approved yet. Every provider query
 * must then filter by `providerId` from here, never from the request body.
 */
export async function requireProviderAccess(
  action: ProviderAction,
  opts: { requireApproved?: boolean } = {}
): Promise<ProviderAccess> {
  const context = await getProviderContext();
  if (!context) throw new ApiError(401, "Please sign in.");
  if (!context.active) throw new ApiError(403, "You are not part of a rental provider.");
  if (!can(context.active.role, action)) throw new ApiError(403, "Your role does not allow this.");
  if (opts.requireApproved && context.active.provider.status !== "approved") {
    throw new ApiError(403, "Your provider account has not been approved yet.");
  }
  return { userId: context.userId, email: context.email, membership: context.active, providerId: context.active.providerId };
}
