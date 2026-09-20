import "server-only";
import { ApiError, NotFoundError } from "@/lib/errors";
import type { Membership } from "@/lib/provider/context";
import { canAccessBranch } from "@/lib/provider/permissions";
import { supabaseAdmin } from "@/lib/supabase-server";
import type { BookingRow } from "@/types/database";

/**
 * Loads a booking only if it belongs to this provider (and, for a branch-scoped
 * member, to their branch). Anything else is a 404, so a booking id from another
 * provider is indistinguishable from one that does not exist.
 */
export async function loadProviderBooking(
  providerId: string,
  membership: Pick<Membership, "branchId">,
  bookingId: string
): Promise<BookingRow> {
  const { data, error } = await supabaseAdmin
    .from("bookings")
    .select("*")
    .eq("id", bookingId)
    .eq("provider_id", providerId)
    .maybeSingle();
  if (error) throw new Error(`load booking: ${error.message}`);
  if (!data) throw new NotFoundError("Booking not found.");
  if (data.pickup_branch_id !== null && !canAccessBranch(membership, data.pickup_branch_id)) {
    throw new ApiError(403, "You can only manage bookings at your own branch.");
  }
  return data;
}
