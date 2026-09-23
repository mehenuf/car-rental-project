/**
 * A Vercel preview deployment must not run against the production database: every pull request would get read and
 * write access to real bookings. Set PRODUCTION_SUPABASE_URL (for both the Production and Preview environments) to
 * the production project's URL and a preview that points at it stops with a clear message instead of starting.
 * Nothing changes when the variable is unset, so this is a safety net on top of scoping the keys in Vercel, not a
 * replacement for it (see docs/GO-LIVE.md).
 */
export function assertNotProductionDataInPreview(env: Record<string, string | undefined>): void {
  if (env.VERCEL_ENV !== "preview") return;
  const production = normalise(env.PRODUCTION_SUPABASE_URL);
  const current = normalise(env.NEXT_PUBLIC_SUPABASE_URL);
  if (production && current && production === current && env.ALLOW_PREVIEW_PRODUCTION_DATA !== "true") {
    throw new Error(
      "This preview deployment is configured with the production Supabase project. Point Preview at a separate project, or set ALLOW_PREVIEW_PRODUCTION_DATA=true if that is really intended."
    );
  }
}

function normalise(url: string | undefined): string {
  return (url ?? "").trim().replace(/\/+$/, "").toLowerCase();
}
