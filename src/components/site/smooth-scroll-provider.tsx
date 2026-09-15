"use client";

import { useEffect, type ReactNode } from "react";
import Lenis from "lenis";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

/**
 * Ultra-smooth inertial scrolling (Lenis), driven by GSAP's own ticker so
 * every ScrollTrigger-based animation in the tree stays perfectly in sync
 * with the smoothed scroll position instead of the raw native one.
 *
 * Respects `prefers-reduced-motion`: Lenis never initializes for a visitor
 * who asked for reduced motion, since inertial/momentum scrolling is a
 * common vestibular trigger — native scroll behavior is the safe default,
 * not a degraded one.
 *
 * Pauses itself while any Base UI dialog/sheet/popover is open. Those
 * components lock body scroll by toggling an inline style or data
 * attribute on <html>/<body>; Lenis intercepts wheel/touch events
 * independently of the CSS scroll lock, so without this the page behind an
 * open modal would still smoothly scroll. A MutationObserver keyed to any
 * scroll-lock signal is more robust than hardcoding one library's exact
 * attribute name, and cheap since it only watches two elements' attributes.
 */
export function SmoothScrollProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const lenis = new Lenis({
      duration: 1.15,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
    });

    lenis.on("scroll", ScrollTrigger.update);

    function tick(time: number) {
      lenis.raf(time * 1000);
    }
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);

    function isScrollLocked(): boolean {
      const lockedByStyle = (el: Element) =>
        (el as HTMLElement).style.overflow === "hidden" ||
        el.getAttribute("data-scroll-locked") !== null;
      return lockedByStyle(document.documentElement) || lockedByStyle(document.body);
    }

    function syncLockState() {
      if (isScrollLocked()) lenis.stop();
      else lenis.start();
    }

    const observer = new MutationObserver(syncLockState);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["style", "data-scroll-locked"] });
    observer.observe(document.body, { attributes: true, attributeFilter: ["style", "data-scroll-locked"] });

    // Every ScrollTrigger caches its trigger element's pixel position at
    // creation time. Client-fetched content (the homepage's vehicle grid
    // swapping its skeleton for real cards), async images, and web-font
    // swaps all shift everything below them without firing a window
    // "resize" event — the one thing ScrollTrigger listens for on its own
    // — so every trigger below that point goes stale and never fires.
    // Watching <body>'s total height and refreshing on any change catches
    // all of those causes generically instead of chasing each one down.
    let refreshTimer: ReturnType<typeof setTimeout>;
    const resizeObserver = new ResizeObserver(() => {
      clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => ScrollTrigger.refresh(), 150);
    });
    resizeObserver.observe(document.body);
    document.fonts?.ready.then(() => ScrollTrigger.refresh());

    return () => {
      clearTimeout(refreshTimer);
      resizeObserver.disconnect();
      observer.disconnect();
      gsap.ticker.remove(tick);
      lenis.destroy();
    };
  }, []);

  return <>{children}</>;
}
