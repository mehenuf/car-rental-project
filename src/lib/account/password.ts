export const MIN_PASSWORD_LENGTH = 10;

export function passwordProblem(password: string): "too_short" | null {
  return password.length < MIN_PASSWORD_LENGTH ? "too_short" : null;
}

async function sha1Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
}

/**
 * Have I Been Pwned k-anonymity check: only the first five hex characters of the SHA-1 leave the server.
 * If the service is unreachable the check fails open, so signing up never depends on a third party.
 */
export async function checkBreached(
  password: string,
  fetchFn: typeof fetch = fetch
): Promise<{ breached: boolean; count: number }> {
  try {
    const hash = await sha1Hex(password);
    const prefix = hash.slice(0, 5);
    const suffix = hash.slice(5);
    const res = await fetchFn(`https://api.pwnedpasswords.com/range/${prefix}`);
    if (!res.ok) return { breached: false, count: 0 };
    for (const line of (await res.text()).split(/\r?\n/)) {
      const [candidate, count] = line.split(":");
      if (candidate?.trim().toUpperCase() === suffix) return { breached: true, count: Number(count) || 0 };
    }
    return { breached: false, count: 0 };
  } catch {
    return { breached: false, count: 0 };
  }
}
