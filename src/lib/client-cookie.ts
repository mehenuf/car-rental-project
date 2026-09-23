/** The cookie string for a browser-set preference cookie: site-wide, one year, and Secure on https. */
export function preferenceCookie(name: string, value: string, secure: boolean): string {
  return `${name}=${value}; path=/; max-age=31536000; samesite=lax${secure ? "; secure" : ""}`;
}

/** Sets a preference cookie from the browser. Secure is added on https so it never travels over plain http. */
export function setPreferenceCookie(name: string, value: string): void {
  document.cookie = preferenceCookie(name, value, window.location.protocol === "https:");
}
