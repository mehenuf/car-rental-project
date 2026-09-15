import { NextResponse } from "next/server";
import { getBookingsForIdentity } from "@/lib/queries";
import { withErrorHandling } from "@/lib/api-response";
import { resolveRequestIdentity } from "@/lib/guest";

export interface MyBookingsContact {
  name: string;
  email: string;
  phone: string | null;
}

/**
 * GET /api/bookings/mine — booking history for the current browser: the
 * signed-in customer's bookings, or a guest's, resolved from the `bc_guest`
 * cookie. Also returns the most recent booking's contact details so the
 * booking form can pre-fill name/email/phone for a returning visitor.
 */
export const GET = withErrorHandling(async () => {
  const identity = await resolveRequestIdentity();
  const bookings = await getBookingsForIdentity(identity);

  const latest = bookings[0];
  const contact: MyBookingsContact | null = latest
    ? { name: latest.customer_name, email: latest.email, phone: latest.phone }
    : null;

  return NextResponse.json({ bookings, contact, signedIn: Boolean(identity.userId) });
});
