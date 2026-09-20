import { describe, expect, it } from "vitest";
import { quoteSigningSecret } from "./secrets";

describe("quoteSigningSecret", () => {
  it("prefers an explicit long secret", () => {
    const s = "x".repeat(40);
    expect(quoteSigningSecret({ QUOTE_SIGNING_SECRET: s, SUPABASE_SERVICE_ROLE_KEY: "k" })).toBe(s);
  });
  it("derives a stable 64-character key from the service key when unset or too short", () => {
    const a = quoteSigningSecret({ SUPABASE_SERVICE_ROLE_KEY: "service-key" });
    expect(a).toHaveLength(64);
    expect(quoteSigningSecret({ QUOTE_SIGNING_SECRET: "short", SUPABASE_SERVICE_ROLE_KEY: "service-key" })).toBe(a);
    expect(quoteSigningSecret({ SUPABASE_SERVICE_ROLE_KEY: "other" })).not.toBe(a);
  });
  it("fails clearly when there is nothing to use", () => {
    expect(() => quoteSigningSecret({})).toThrow(/QUOTE_SIGNING_SECRET/);
  });
});
