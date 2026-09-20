"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export interface ThreadLabels {
  empty: string;
  placeholder: string;
  send: string;
  sending: string;
  you: string;
  them: string;
  platform: string;
  loadFailed: string;
}

interface Message {
  id: string;
  sender_side: "customer" | "provider" | "platform";
  body: string;
  created_at: string;
}

/**
 * A booking's message thread. Used by the customer account (`/api/account/messages`) and the provider
 * portal (`/api/provider/messages`); labels come from the caller so the provider portal stays English.
 */
export function MessageThread({
  bookingId,
  endpoint,
  mySide,
  labels,
  locale = "en",
}: {
  bookingId: string;
  endpoint: string;
  mySide: "customer" | "provider";
  labels: ThreadLabels;
  locale?: string;
}) {
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${endpoint}?booking=${bookingId}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? labels.loadFailed);
      setMessages(json.data as Message[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : labels.loadFailed);
    }
  }, [endpoint, bookingId, labels.loadFailed]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await load();
      if (cancelled) return;
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  async function send(e: FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ booking_id: bookingId, body }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error?.message ?? labels.loadFailed);
      setBody("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : labels.loadFailed);
    } finally {
      setBusy(false);
    }
  }

  const time = (iso: string) => new Date(iso).toLocaleString(locale === "en" ? "en-GB" : locale, { dateStyle: "medium", timeStyle: "short" });

  return (
    <div className="flex flex-col gap-(--space-xs)">
      <ul className="flex max-h-72 flex-col gap-2 overflow-y-auto" aria-live="polite">
        {messages?.length === 0 && <li className="text-sm text-muted-foreground">{labels.empty}</li>}
        {(messages ?? []).map((m) => {
          const mine = m.sender_side === mySide;
          return (
            <li key={m.id} className={cn("flex flex-col gap-0.5 rounded-lg px-3 py-2 text-sm", mine ? "self-end bg-primary/10" : "self-start bg-muted", m.sender_side === "platform" && "italic")}>
              <span className="text-xs text-muted-foreground">
                {m.sender_side === "platform" ? labels.platform : mine ? labels.you : labels.them} · {time(m.created_at)}
              </span>
              <span className="whitespace-pre-wrap break-words text-foreground">{m.body}</span>
            </li>
          );
        })}
      </ul>
      <form onSubmit={send} className="flex flex-col gap-2">
        <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={2} maxLength={2000} placeholder={labels.placeholder} aria-label={labels.placeholder} />
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <Button type="submit" size="sm" className="self-start" disabled={busy || !body.trim()}>
          {busy ? labels.sending : labels.send}
        </Button>
      </form>
    </div>
  );
}
