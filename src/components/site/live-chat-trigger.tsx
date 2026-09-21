"use client";

import { OPEN_CHAT_EVENT } from "@/components/site/chat-events";

/** Makes the Contact page's "Live chat" row actually open the widget,
 * instead of just describing where the launcher lives. */
export function LiveChatTrigger({ children }: { children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event(OPEN_CHAT_EVENT))}
      className="flex w-full items-center gap-4 py-(--space-md) text-start transition-colors hover:bg-muted/50 focus-visible:bg-muted/50"
    >
      {children}
    </button>
  );
}
