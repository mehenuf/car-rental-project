import { createHash, timingSafeEqual } from "node:crypto";
import { ApiError } from "@/lib/errors";

function digest(value: string): Buffer {
  return createHash("sha256").update(value).digest();
}

/**
 * Guards the scheduled endpoints. Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`.
 * With no secret configured the endpoint refuses to run (503) rather than being open to anyone.
 */
export function verifyCronAuth(authorizationHeader: string | null, secret: string | undefined): void {
  if (!secret) throw new ApiError(503, "Scheduled jobs are not configured.");
  const expected = `Bearer ${secret}`;
  const provided = authorizationHeader ?? "";
  if (!timingSafeEqual(digest(provided), digest(expected))) {
    throw new ApiError(401, "Unauthorized");
  }
}
