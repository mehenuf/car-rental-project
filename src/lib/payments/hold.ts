/** True while an unpaid booking's 15 minute hold is still running. A booking with no hold (legacy) never expires. */
export function isHoldActive(holdExpiresAt: string | null, now: Date = new Date()): boolean {
  return holdExpiresAt === null || new Date(holdExpiresAt).getTime() > now.getTime();
}
