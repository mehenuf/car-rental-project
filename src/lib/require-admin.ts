import "server-only";
import { requireStaff, type StaffContext } from "@/lib/admin/staff";
import type { Permission } from "@/lib/admin/permissions";

/**
 * Guards a legacy admin route handler (the original dashboard, vehicle, booking and lead APIs).
 * `proxy.ts` only gates page navigation, never `/api/*`, so every such route calls this first.
 *
 * It means: signed in with the admin claim (settable only with the service role), an active role in
 * `platform_staff` that holds `permission`, and a completed second factor when `ADMIN_REQUIRE_MFA=true`.
 * The permission is required, not optional, so a route cannot be guarded by "any staff role" by accident:
 * a reviewer or finance account must not read leads, or cancel bookings, just because it can sign in.
 */
export async function requireAdmin(permission: Permission): Promise<StaffContext> {
  return requireStaff(permission);
}
