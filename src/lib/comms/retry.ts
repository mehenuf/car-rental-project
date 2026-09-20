export const MAX_ATTEMPTS = 5;

/** Wait before attempt N+1, after N failed attempts: 1 minute, 5 minutes, 30 minutes, 2 hours, 12 hours. */
const BACKOFF_MINUTES = [1, 5, 30, 120, 720];

/** When to retry after `attempts` failures, or null once the notification has used up its attempts. */
export function nextAttemptAt(now: Date, attempts: number): Date | null {
  if (attempts < 1 || attempts > MAX_ATTEMPTS) return null;
  return new Date(now.getTime() + BACKOFF_MINUTES[attempts - 1]! * 60_000);
}

/** One notification per event, channel, recipient and template, enforced unique in the database. */
export function dedupeKey(eventId: string, channel: string, recipient: string, template: string): string {
  return [eventId, channel, recipient.trim().toLowerCase(), template].join("|");
}
