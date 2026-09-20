/**
 * A cross-site request forgery guard for state-changing API calls. Browsers always send `Origin` on cross-site
 * POSTs, so a request whose Origin is another site is refused. A request with no Origin (a server, a webhook, a
 * cron call) is not a browser form post and is allowed: those are authenticated by signature or secret instead.
 */
export function isAllowedOrigin(origin: string | null, host: string | null, extraAllowed: string[] = []): boolean {
  if (origin === null) return true;
  let parsed: URL;
  try {
    parsed = new URL(origin);
  } catch {
    return false;
  }
  if (host && parsed.host === host) return true;
  return extraAllowed.some((allowed) => {
    try {
      return new URL(allowed).origin === parsed.origin;
    } catch {
      return false;
    }
  });
}
