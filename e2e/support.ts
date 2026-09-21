import type { APIRequestContext } from "@playwright/test";

/**
 * True when the app can read its database and it holds the sample data. CI builds against a placeholder database, where
 * pages that need cars answer 200 with an error page, so a status check alone is not enough to know a test can run.
 */
export async function hasSampleData(request: APIRequestContext): Promise<boolean> {
  const response = await request.get("/api/locations");
  if (!response.ok()) return false;
  const body = (await response.json().catch(() => [])) as unknown;
  return Array.isArray(body) && body.length > 0;
}
