"use client";

import { useEffect, useState } from "react";

/** Returns `value`, but only after it hasn't changed for `delayMs` — the
 * standard debounced-search-input pattern, shared so every admin table's
 * search box uses the identical delay/behavior instead of each page
 * re-implementing the same effect. */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timeout = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timeout);
  }, [value, delayMs]);

  return debounced;
}
