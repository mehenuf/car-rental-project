"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "bestcar:favorites";

function readFavorites(): Set<string> {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch {
    return new Set();
  }
}

function writeFavorites(favorites: Set<string>) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(favorites)));
  } catch {
    // Private browsing / storage disabled — favoriting just won't persist.
  }
}

/**
 * Vehicle favorites, persisted to localStorage. Starts empty on both the
 * server-rendered HTML and the client's first paint (localStorage isn't
 * available during SSR), then syncs the real set right after mount — the
 * standard way to read an external browser API without a hydration
 * mismatch. That's a legitimate use of an effect (synchronizing with an
 * external system), so the setState calls below are intentional.
 */
export function useFavorites() {
  const [favorites, setFavorites] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFavorites(readFavorites());
  }, []);

  const toggleFavorite = useCallback((id: string) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      writeFavorites(next);
      return next;
    });
  }, []);

  const isFavorite = useCallback((id: string) => favorites.has(id), [favorites]);

  return { isFavorite, toggleFavorite };
}
