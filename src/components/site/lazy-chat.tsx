"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { OPEN_CHAT_EVENT } from "@/components/site/chat-events";

const ChatWidget = dynamic(() => import("@/components/site/chat-widget").then((mod) => mod.ChatWidget), { ssr: false });

/**
 * The chat launcher and panel are loaded once the browser is idle (or at once when a page asks for the chat), so
 * their code is not part of the first load. A request that arrives before the code is ready opens the chat as soon as
 * it mounts.
 */
export function LazyChat() {
  const [ready, setReady] = useState(false);
  const [openOnMount, setOpenOnMount] = useState(false);

  useEffect(() => {
    const start = () => setReady(true);
    const onRequest = () => {
      setOpenOnMount(true);
      setReady(true);
    };
    window.addEventListener(OPEN_CHAT_EVENT, onRequest);
    // Older Safari has no requestIdleCallback; a short timer does the same job there.
    const ric = window.requestIdleCallback as typeof window.requestIdleCallback | undefined;
    const handle = ric ? ric(start, { timeout: 3000 }) : window.setTimeout(start, 2000);
    return () => {
      window.removeEventListener(OPEN_CHAT_EVENT, onRequest);
      if (ric) window.cancelIdleCallback(handle);
      else window.clearTimeout(handle);
    };
  }, []);

  return ready ? <ChatWidget initiallyOpen={openOnMount} /> : null;
}
