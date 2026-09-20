import "server-only";
import { after } from "next/server";
import { dispatchAll } from "./dispatcher";
import { dispatchDeps } from "./deps";

/** One dispatcher pass now. Safe to run concurrently: claims are leased in the database. */
export async function runDispatch() {
  return dispatchAll(dispatchDeps());
}

/**
 * Sends notifications right after the current request finishes, so customers get email within
 * seconds. Failures are logged and left for the scheduled retry; they never break the request.
 */
export function dispatchSoon(): void {
  after(async () => {
    try {
      await runDispatch();
    } catch (err) {
      console.error("dispatchSoon failed", err);
    }
  });
}
