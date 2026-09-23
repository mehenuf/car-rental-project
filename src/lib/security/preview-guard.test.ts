import { describe, expect, it } from "vitest";
import { assertNotProductionDataInPreview } from "@/lib/security/preview-guard";

const PROD = "https://abc.supabase.co";

describe("assertNotProductionDataInPreview", () => {
  it("stops a preview that points at the production project", () => {
    expect(() => assertNotProductionDataInPreview({ VERCEL_ENV: "preview", PRODUCTION_SUPABASE_URL: PROD, NEXT_PUBLIC_SUPABASE_URL: PROD })).toThrow(/production Supabase project/);
  });

  it("compares the addresses without caring about case or a trailing slash", () => {
    expect(() => assertNotProductionDataInPreview({ VERCEL_ENV: "preview", PRODUCTION_SUPABASE_URL: PROD, NEXT_PUBLIC_SUPABASE_URL: "HTTPS://ABC.supabase.co/" })).toThrow();
  });

  it("lets production, development and a separate preview project through", () => {
    expect(() => assertNotProductionDataInPreview({ VERCEL_ENV: "production", PRODUCTION_SUPABASE_URL: PROD, NEXT_PUBLIC_SUPABASE_URL: PROD })).not.toThrow();
    expect(() => assertNotProductionDataInPreview({ PRODUCTION_SUPABASE_URL: PROD, NEXT_PUBLIC_SUPABASE_URL: PROD })).not.toThrow();
    expect(() => assertNotProductionDataInPreview({ VERCEL_ENV: "preview", PRODUCTION_SUPABASE_URL: PROD, NEXT_PUBLIC_SUPABASE_URL: "https://staging.supabase.co" })).not.toThrow();
  });

  it("does nothing until the production address is configured, and honours an explicit override", () => {
    expect(() => assertNotProductionDataInPreview({ VERCEL_ENV: "preview", NEXT_PUBLIC_SUPABASE_URL: PROD })).not.toThrow();
    expect(() => assertNotProductionDataInPreview({ VERCEL_ENV: "preview", PRODUCTION_SUPABASE_URL: PROD, NEXT_PUBLIC_SUPABASE_URL: PROD, ALLOW_PREVIEW_PRODUCTION_DATA: "true" })).not.toThrow();
  });
});
