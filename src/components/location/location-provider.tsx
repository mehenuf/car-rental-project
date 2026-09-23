"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { setPreferenceCookie } from "@/lib/client-cookie";
import { pickDefaultPlace, type Place } from "@/lib/location/places";

const COOKIE = "bc_loc";

interface LocationContextValue {
  places: Place[];
  loading: boolean;
  /** The visitor's chosen place, or the one we guessed for them when they have not chosen yet. */
  selected: Place | null;
  /** The place we guessed from the connection, if any (may equal `selected`). */
  detected: Place | null;
  /** True once the visitor has chosen a place themselves. */
  chosen: boolean;
  select: (place: Place) => void;
}

const LocationContext = createContext<LocationContextValue | null>(null);

function readCookie(): number | null {
  const raw = document.cookie.split("; ").find((c) => c.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/**
 * Holds the places we serve and which one the visitor is looking in. A first-time visitor gets a sensible guess
 * (their city or country, from the hosting platform's edge headers, with no permission prompt); once they choose,
 * the choice is remembered in a small functional cookie so the header, the search bar and the car list agree.
 */
export function LocationProvider({ children }: { children: ReactNode }) {
  const [places, setPlaces] = useState<Place[]>([]);
  const [loading, setLoading] = useState(true);
  const [chosenId, setChosenId] = useState<number | null>(null);
  const [detected, setDetected] = useState<Place | null>(null);

  useEffect(() => {
    let cancelled = false;
    // The cookie only exists in the browser, so it is read after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setChosenId(readCookie());
    (async () => {
      try {
        const [placesRes, geoRes] = await Promise.all([fetch("/api/locations"), fetch("/api/geo").catch(() => null)]);
        const list = placesRes.ok ? ((await placesRes.json()) as Place[]) : [];
        const geo = geoRes && geoRes.ok ? ((await geoRes.json()) as { country: string | null; city: string | null }) : { country: null, city: null };
        if (cancelled) return;
        setPlaces(list);
        // Only guess when the platform actually told us something; otherwise leave the choice to the visitor.
        setDetected(geo.country || geo.city ? pickDefaultPlace(list, geo) : null);
      } catch {
        // No places means the selector simply stays empty; the rest of the site still works.
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const select = useCallback((place: Place) => {
    setPreferenceCookie(COOKIE, String(place.id));
    setChosenId(place.id);
  }, []);

  const value = useMemo<LocationContextValue>(() => {
    const chosenPlace = chosenId ? (places.find((p) => p.id === chosenId) ?? null) : null;
    return {
      places,
      loading,
      selected: chosenPlace ?? detected,
      detected,
      chosen: Boolean(chosenPlace),
      select,
    };
  }, [places, loading, chosenId, detected, select]);

  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>;
}

export function useLocation(): LocationContextValue {
  const ctx = useContext(LocationContext);
  if (!ctx) throw new Error("useLocation must be used inside LocationProvider");
  return ctx;
}
