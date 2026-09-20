"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Re-reads the page's server data a few times, for the short gap between paying and the processor's confirmation arriving. */
export function AutoRefresh({ intervalMs = 3000, maxRefreshes = 10 }: { intervalMs?: number; maxRefreshes?: number }) {
  const router = useRouter();

  useEffect(() => {
    let count = 0;
    const timer = setInterval(() => {
      count += 1;
      router.refresh();
      if (count >= maxRefreshes) clearInterval(timer);
    }, intervalMs);
    return () => clearInterval(timer);
  }, [router, intervalMs, maxRefreshes]);

  return null;
}
