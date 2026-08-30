"use client";

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import Link from "next/link";
import { MessageCircle, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { VehicleImage } from "@/components/site/vehicle-image";
import { formatCurrency } from "@/lib/format";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

interface RecommendedVehicle {
  slug: string;
  name: string;
  image_url: string;
  price_per_day: number;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  recommendedVehicles?: RecommendedVehicle[];
}

const SUGGESTED_QUESTIONS = [
  "I need a car for 5 people",
  "What's your cheapest option?",
  "Do you have electric cars?",
];

/** Matches the hidden marker prompts.ts tells the AI to end recommendation
 * replies with — stripped out before the text is shown to the visitor. */
const RECOMMENDATIONS_TAG = /<recommendations>([\s\S]*?)<\/recommendations>/i;

function toApiMessages(messages: ChatMessage[]) {
  return messages.map(({ role, content }) => ({ role, content }));
}

interface SessionCustomerInfo {
  customer_name?: string;
  customer_email?: string;
}

/**
 * Only returns fields when a real session exists — a guest gets `{}`, not
 * `{ customer_name: "", customer_email: "" }`. An empty string would mean
 * something different from "we don't know," and the score route relies on
 * that distinction to decide whether to trust this over what the AI finds.
 */
async function getSessionCustomerInfo(): Promise<SessionCustomerInfo> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user;
  if (!user) return {};

  const info: SessionCustomerInfo = {};
  const fullName = user.user_metadata?.full_name;
  if (typeof fullName === "string" && fullName.trim()) info.customer_name = fullName;
  if (user.email) info.customer_email = user.email;
  return info;
}

export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [launcherBlocked, setLauncherBlocked] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, open]);

  // The closed launcher is pinned to a screen corner on every page, so it can
  // land on top of a page's own call-to-action (e.g. "Book Now" on a vehicle
  // page). A page opts an element out of that overlap with `data-chat-avoid`;
  // we fade the launcher out while it would otherwise cover one.
  useEffect(() => {
    if (open) return;
    const launcher = launcherRef.current;
    if (!launcher) return;

    let frame = 0;
    function updateBlocked() {
      frame = 0;
      const launcherRect = launcher!.getBoundingClientRect();
      const blocked = Array.from(
        document.querySelectorAll<HTMLElement>("[data-chat-avoid]")
      ).some((el) => {
        const r = el.getBoundingClientRect();
        return (
          launcherRect.left < r.right &&
          launcherRect.right > r.left &&
          launcherRect.top < r.bottom &&
          launcherRect.bottom > r.top
        );
      });
      setLauncherBlocked(blocked);
    }
    function scheduleUpdate() {
      if (frame) return;
      frame = requestAnimationFrame(updateBlocked);
    }

    updateBlocked();
    window.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", scheduleUpdate);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
    };
  }, [open]);

  async function sendMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const outgoing: ChatMessage[] = [...messages, { role: "user", content: trimmed }];
    setMessages([...outgoing, { role: "assistant", content: "" }]);
    setInput("");
    setLoading(true);

    const sessionInfo = await getSessionCustomerInfo();

    function updateLastMessage(update: Partial<ChatMessage>) {
      setMessages((prev) => {
        const next = [...prev];
        next[next.length - 1] = { ...next[next.length - 1], ...update };
        return next;
      });
    }

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: toApiMessages(outgoing), ...sessionInfo }),
      });

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let fullText = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          fullText += decoder.decode(value, { stream: true });
          updateLastMessage({ content: fullText });
        }
      } else {
        fullText = await res.text();
      }

      const tagMatch = fullText.match(RECOMMENDATIONS_TAG);
      const visibleText = fullText.replace(RECOMMENDATIONS_TAG, "").trim();
      const slugs = tagMatch
        ? tagMatch[1]
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
            .slice(0, 3)
        : [];

      updateLastMessage({ content: visibleText });
      let finalAssistantMessage: ChatMessage = { role: "assistant", content: visibleText };

      if (slugs.length > 0) {
        const settled = await Promise.allSettled(
          slugs.map(async (slug) => {
            const r = await fetch(`/api/vehicles/${slug}`);
            if (!r.ok) throw new Error(`vehicle "${slug}" not found`);
            const v = await r.json();
            return {
              slug: v.slug,
              name: v.name,
              image_url: v.image_url,
              price_per_day: v.price_per_day,
            } satisfies RecommendedVehicle;
          })
        );

        // A slug the AI mentioned that doesn't actually exist just quietly
        // produces no card for it — never shown as an error.
        const vehicles = settled
          .filter((r): r is PromiseFulfilledResult<RecommendedVehicle> => r.status === "fulfilled")
          .map((r) => r.value);

        if (vehicles.length > 0) {
          updateLastMessage({ recommendedVehicles: vehicles });
          finalAssistantMessage = { ...finalAssistantMessage, recommendedVehicles: vehicles };
        }
      }

      const finalMessages = [...outgoing, finalAssistantMessage];

      // Fire-and-forget: the visitor never sees this, and it must never
      // block or fail the actual conversation above.
      if (finalMessages.length >= 3) {
        fetch("/api/chat/score", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: toApiMessages(finalMessages), ...sessionInfo }),
        }).catch(() => {});
      }
    } catch {
      updateLastMessage({ content: "Sorry, something went wrong. Please try again in a moment." });
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    sendMessage(input);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage(input);
    }
  }

  return (
    <>
      {!open && (
        <button
          ref={launcherRef}
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open chat"
          aria-hidden={launcherBlocked}
          tabIndex={launcherBlocked ? -1 : 0}
          className={cn(
            "fixed bottom-6 left-6 z-50 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-[opacity,transform] hover:scale-105",
            launcherBlocked ? "pointer-events-none opacity-0" : "opacity-100"
          )}
        >
          <MessageCircle className="size-6" />
        </button>
      )}

      {open && (
        <div
          role="dialog"
          aria-modal="false"
          aria-labelledby="chat-widget-title"
          className="fixed inset-0 z-50 flex flex-col bg-card sm:inset-auto sm:bottom-6 sm:left-6 sm:h-[600px] sm:w-96 sm:rounded-2xl sm:border sm:border-border sm:shadow-xl"
        >
          <div className="flex h-16 shrink-0 items-center justify-between border-b border-border px-(--space-sm)">
            <span id="chat-widget-title" className="font-heading text-base font-semibold text-foreground">
              Best Auto Assistant
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close chat"
              className="flex size-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="size-5" />
            </button>
          </div>

          <div
            role="log"
            aria-live="polite"
            aria-label="Chat messages"
            className="flex flex-1 flex-col gap-(--space-sm) overflow-y-auto p-(--space-sm)"
          >
            {messages.length === 0 && (
              <div className="flex flex-col gap-(--space-xs)">
                <p className="text-sm text-muted-foreground">
                  Hi! Ask me about our cars, or try one of these:
                </p>
                {SUGGESTED_QUESTIONS.map((question) => (
                  <button
                    key={question}
                    type="button"
                    onClick={() => sendMessage(question)}
                    className="rounded-lg border border-border px-3 py-2 text-left text-sm text-foreground hover:bg-muted"
                  >
                    {question}
                  </button>
                ))}
              </div>
            )}

            {messages.map((message, index) => (
              <div
                key={index}
                className={cn("flex", message.role === "user" ? "justify-end" : "justify-start")}
              >
                <div className="flex max-w-[85%] flex-col gap-(--space-xs)">
                  <div
                    className={cn(
                      "min-h-8 rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap",
                      message.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-foreground"
                    )}
                  >
                    {message.content ||
                      (loading && index === messages.length - 1 ? (
                        <span className="inline-flex gap-1">
                          <span className="size-1.5 animate-pulse rounded-full bg-current [animation-delay:-0.3s]" />
                          <span className="size-1.5 animate-pulse rounded-full bg-current [animation-delay:-0.15s]" />
                          <span className="size-1.5 animate-pulse rounded-full bg-current" />
                        </span>
                      ) : (
                        ""
                      ))}
                  </div>

                  {message.recommendedVehicles && message.recommendedVehicles.length > 0 && (
                    <div className="flex flex-col gap-2">
                      {message.recommendedVehicles.map((vehicle) => (
                        <Link
                          key={vehicle.slug}
                          href={`/cars/${vehicle.slug}`}
                          onClick={() => setOpen(false)}
                          className="flex items-center gap-2.5 rounded-xl border border-border bg-card p-2 transition-colors hover:bg-muted"
                        >
                          <div className="relative size-12 shrink-0 overflow-hidden rounded-lg bg-muted">
                            <VehicleImage
                              src={vehicle.image_url}
                              alt={vehicle.name}
                              fill
                              sizes="48px"
                              className="object-cover"
                            />
                          </div>
                          <div className="flex min-w-0 flex-col">
                            <span className="truncate text-sm font-medium text-foreground">
                              {vehicle.name}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {formatCurrency(vehicle.price_per_day)}/day
                            </span>
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}

            <div ref={bottomRef} />
          </div>

          <form
            onSubmit={handleSubmit}
            className="flex shrink-0 items-end gap-2 border-t border-border p-(--space-sm)"
          >
            <Textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about a car..."
              aria-label="Message"
              disabled={loading}
              rows={1}
              className="max-h-32 min-h-9 flex-1 resize-none py-2"
            />
            <Button
              type="submit"
              size="icon"
              disabled={loading || !input.trim()}
              aria-label="Send message"
            >
              <Send className="size-4" />
            </Button>
          </form>
        </div>
      )}
    </>
  );
}
