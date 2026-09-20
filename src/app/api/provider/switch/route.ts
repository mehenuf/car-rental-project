import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { withErrorHandling } from "@/lib/api-response";
import { ApiError } from "@/lib/errors";
import { ACTIVE_PROVIDER_COOKIE, getProviderContext } from "@/lib/provider/context";
import { SwitchProviderSchema } from "@/lib/provider/schemas";

/** POST /api/provider/switch — chooses which of the caller's providers the portal is acting for. */
export const POST = withErrorHandling(async (request: NextRequest) => {
  const context = await getProviderContext();
  if (!context) throw new ApiError(401, "Please sign in.");

  const { provider_id } = SwitchProviderSchema.parse(await request.json());
  if (!context.memberships.some((m) => m.providerId === provider_id)) {
    throw new ApiError(403, "You are not part of that provider.");
  }

  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_PROVIDER_COOKIE, provider_id, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 90 });
  return NextResponse.json({ ok: true });
});
