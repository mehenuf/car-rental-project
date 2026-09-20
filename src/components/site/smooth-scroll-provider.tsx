"use client";

import { useEffect, type ReactNode } from "react";

/** Anything that scrolls by itself and should not be driven by the page's smooth scrolling. */
const SELF_SCROLLING = [
  "[data-lenis-prevent]",
  "[role='menu']",
  "[role='listbox']",
  "[role='dialog']",
  "[data-slot='popover-content']",
  "[data-slot='select-content']",
  "[data-slot='dropdown-menu-content']",
  "[data-slot='sheet-content']",
].join(",");

/**
 * Smooth, inertial wheel scrolling (Lenis) for mouse and trackpad users only. Touch screens keep the browser's own
 * scrolling, which is already smooth and is what people expect there, and reduced-motion visitors keep it too. The
 * library is loaded after the page is idle, so it never delays the first paint.
 *
 * It pauses while a dialog or sheet has locked the page's scroll.
 */
export function SmoothScrollProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    const wanted = window.matchMedia("(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)");
    if (!wanted.matches) return;

    let destroy: (() => void) | undefined;
    let cancelled = false;

    const start = async () => {
      const { default: Lenis } = await import("lenis");
      if (cancelled) return;
      const lenis = new Lenis({
        autoRaf: true,
        duration: 1.15,
        easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        smoothWheel: true,
        // Lists that scroll on their own must keep their wheel events or they cannot be scrolled.
        prevent: (node) => node.closest(SELF_SCROLLING) !== null,
        // In-page links (#search-bar, #how-it-works) glide instead of jumping.
        anchors: { offset: -80 },
        wheelMultiplier: 0.9,
      });

      const locked = (el: Element) =>
        (el as HTMLElement).style.overflow === "hidden" || el.getAttribute("data-scroll-locked") !== null;
      const sync = () => (locked(document.documentElement) || locked(document.body) ? lenis.stop() : lenis.start());
      const observer = new MutationObserver(sync);
      const options = { attributes: true, attributeFilter: ["style", "data-scroll-locked"] };
      observer.observe(document.documentElement, options);
      observer.observe(document.body, options);

      destroy = () => {
        observer.disconnect();
        lenis.destroy();
      };
    };

    const idle = window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 500));
    const handle = idle(() => void start());

    return () => {
      cancelled = true;
      if (window.cancelIdleCallback && typeof handle === "number") window.cancelIdleCallback(handle);
      destroy?.();
    };
  }, []);

  return <>{children}</>;
}
