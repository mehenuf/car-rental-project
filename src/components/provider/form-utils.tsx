"use client";

import { useState } from "react";

/** Sends JSON and throws an Error carrying the API's message (or its first field problem). */
export async function send(url: string, method: string, body?: unknown): Promise<void> {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    const issue = data?.error?.issues?.[0];
    throw new Error(issue ? `${issue.path}: ${issue.message}` : (data?.error?.message ?? "Something went wrong."));
  }
}

/** Tracks a save in progress and the message to show when it ends. */
export function useSave() {
  const [state, setState] = useState<{ busy: boolean; message: string | null; ok: boolean }>({ busy: false, message: null, ok: false });
  async function run(fn: () => Promise<void>, success = "Saved.") {
    setState({ busy: true, message: null, ok: false });
    try {
      await fn();
      setState({ busy: false, message: success, ok: true });
    } catch (err) {
      setState({ busy: false, message: err instanceof Error ? err.message : "Something went wrong.", ok: false });
    }
  }
  return { ...state, run };
}

export function Status({ message, ok }: { message: string | null; ok: boolean }) {
  return message ? (
    <p role={ok ? "status" : "alert"} className={ok ? "text-sm text-muted-foreground" : "text-sm text-destructive"}>
      {message}
    </p>
  ) : null;
}
