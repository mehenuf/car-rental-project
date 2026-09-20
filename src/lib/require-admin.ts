import "server-only";
import { requireStaff } from "@/lib/admin/staff";

/**
 * Guards an admin-only route handler that has no finer permission of its own (the original dashboard,
 * vehicle, booking and lead APIs). `proxy.ts` only gates page navigation, never `/api/*`, so every
 * such route calls this first. It now means: signed in with the admin claim (settable only with the
 * service role), an active role in `platform_staff`, and a completed second factor unless
 * `ADMIN_REQUIRE_MFA=false`. Routes with a specific permission call `requireStaff(permission)` directly.
 */
export async function requireAdmin(): Promise<void> {
  await requireStaff();
}
