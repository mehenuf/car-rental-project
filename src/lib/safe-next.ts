/**
 * The page to return to after signing in, from a `?next=` value. Only a plain path on this site is accepted:
 * it must start with one slash and contain no scheme, host, backslash or control character, so the sign-in page
 * cannot be used to send someone to another site. Anything else returns null and the caller uses its default.
 * The path is language-free (the router adds the current language).
 */
export function safeNext(value: string | string[] | null | undefined): string | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw || raw.length > 300) return null;
  if (!raw.startsWith("/") || raw.startsWith("//")) return null;
  if (raw.includes("\\") || [...raw].some((char) => char.charCodeAt(0) < 32)) return null;
  if (/^\/[a-z][a-z0-9+.-]*:/i.test(raw)) return null;
  if (raw.startsWith("/admin") || raw.startsWith("/api")) return null;
  return raw;
}
