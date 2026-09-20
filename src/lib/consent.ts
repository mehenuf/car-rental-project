export const CONSENT_COOKIE = "bc_consent";
/** Matches the seeded row in `policy_versions`; bump both when the cookie or privacy policy changes. */
export const CURRENT_POLICY_VERSION = "2026-09";

export interface ConsentChoice {
  v: string;
  analytics: boolean;
}

export function encodeConsent(choice: { analytics: boolean }): string {
  return encodeURIComponent(JSON.stringify({ v: CURRENT_POLICY_VERSION, analytics: choice.analytics } satisfies ConsentChoice));
}

export function decodeConsent(raw: string | undefined | null): ConsentChoice | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(raw)) as Partial<ConsentChoice>;
    return typeof parsed.v === "string" && typeof parsed.analytics === "boolean" ? { v: parsed.v, analytics: parsed.analytics } : null;
  } catch {
    return null;
  }
}

/** Ask again when nothing is saved or the policy changed since the last answer. */
export function needsBanner(raw: string | undefined | null): boolean {
  const choice = decodeConsent(raw);
  return !choice || choice.v !== CURRENT_POLICY_VERSION;
}

/** Analytics run only after an explicit yes for the current policy version. */
export function analyticsAllowed(raw: string | undefined | null): boolean {
  const choice = decodeConsent(raw);
  return Boolean(choice && choice.v === CURRENT_POLICY_VERSION && choice.analytics);
}
