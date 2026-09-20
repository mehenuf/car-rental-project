import "server-only";
import { cookies, headers } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { ApiError } from "@/lib/errors";
import { supabaseAdmin } from "@/lib/supabase-server";
import { buildAuditRow, type AuditInput } from "./audit";
import { can, type Permission, type StaffRole } from "./permissions";

export interface StaffContext {
  userId: string;
  email: string | null;
  role: StaffRole;
}

/** Two-factor sign-in for staff is opt-in: set ADMIN_REQUIRE_MFA=true once staff have enrolled an authenticator. */
export function mfaRequired(): boolean {
  return process.env.ADMIN_REQUIRE_MFA === "true";
}

async function sessionClient() {
  const cookieStore = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Server Components cannot write cookies; a route handler will refresh the token next time.
        }
      },
    },
  });
}

/**
 * The signed-in staff member for this request: needs the admin claim (set only by the service role),
 * a role in `platform_staff`, and, when required, a second factor completed in this session (AAL2).
 */
export async function requireStaff(permission?: Permission): Promise<StaffContext> {
  const supabase = await sessionClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.app_metadata?.role !== "admin") throw new ApiError(401, "Admin authentication required");

  const { data: role } = await supabaseAdmin.rpc("staff_role", { p_user: user.id });
  if (!role) throw new ApiError(403, "Your account is not active platform staff.");

  if (mfaRequired()) {
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal?.currentLevel !== "aal2") throw new ApiError(403, "Two-factor sign-in is required. Verify your code first.");
  }

  const staffRole = role as StaffRole;
  if (permission && !can(staffRole, permission)) throw new ApiError(403, "Your role cannot do that.");
  return { userId: user.id, email: user.email ?? null, role: staffRole };
}

/** Records an audit entry for a staff action. Never throws into the caller's success path without saying so. */
export async function writeAudit(ctx: StaffContext, entry: Omit<AuditInput, "actor" | "headers">): Promise<void> {
  const row = buildAuditRow({ ...entry, actor: { userId: ctx.userId, role: ctx.role }, headers: await headers() });
  const { error } = await supabaseAdmin.from("audit_log").insert(row);
  if (error) throw new Error(`audit: ${error.message}`);
}
