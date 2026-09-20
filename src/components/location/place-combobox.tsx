"use client";

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Check, LocateFixed, MapPin, SearchX } from "lucide-react";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/provider";
import { FIELD_CLASS } from "@/components/site/date-picker-field";
import { groupByCountry, highlightParts, placeLabel, searchPlaces, type Place } from "@/lib/location/places";

/** A place name with the part the visitor typed picked out. */
function Highlighted({ text, query }: { text: string; query: string }) {
  return (
    <>
      {highlightParts(text, query).map((part, i) =>
        part.match ? (
          <mark key={i} className="rounded-sm bg-accent/25 px-0.5 text-inherit">
            {part.text}
          </mark>
        ) : (
          <span key={i}>{part.text}</span>
        )
      )}
    </>
  );
}

/**
 * Search-as-you-type place picker, built on the ARIA combobox pattern: type to filter, arrow keys to move, Enter
 * to choose, Escape to close. Results are grouped by country and matches are highlighted. With `inline` the list
 * is always shown (for use inside a popover); otherwise it opens under the field.
 *
 * Places come from our own branches, so no external service or API key is involved. The search sits behind
 * `searchPlaces`, so a hosted address search could replace it later without touching this component's look.
 */
export function PlaceCombobox({
  places,
  value,
  onChange,
  label,
  detected,
  inline = false,
  autoFocus = false,
  className,
  triggerClassName,
}: {
  places: Place[];
  value: Place | null;
  onChange: (place: Place) => void;
  /** Visible label above the field (omit when the surrounding UI already names it). */
  label?: string;
  /** A place guessed for the visitor, offered at the top as "Near you". */
  detected?: Place | null;
  inline?: boolean;
  autoFocus?: boolean;
  className?: string;
  triggerClassName?: string;
}) {
  const t = useT();
  const id = useId();
  const listId = `${id}-list`;
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(inline);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);

  const results = useMemo(() => searchPlaces(places, query), [places, query]);
  const nearYou = !query && detected && detected.id !== value?.id ? detected : null;
  // One flat list drives the keyboard: the "near you" row first, then every result in group order.
  const groups = useMemo(() => groupByCountry(results), [results]);
  const flat = useMemo(() => [...(nearYou ? [nearYou] : []), ...groups.flatMap((g) => g.places)], [nearYou, groups]);
  // Each place with its position in the flat list, so rows can be matched to the keyboard's highlighted index.
  const indexed = useMemo(() => {
    let next = nearYou ? 1 : 0;
    return groups.map((group) => ({ ...group, rows: group.places.map((place) => ({ place, index: next++ })) }));
  }, [groups, nearYou]);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  // Keep the highlighted row in view as the keyboard moves.
  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  function choose(place: Place) {
    onChange(place);
    setQuery("");
    if (!inline) {
      setOpen(false);
      inputRef.current?.blur();
    }
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(flat.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === "Home" && open) {
      setActive(0);
    } else if (e.key === "End" && open) {
      setActive(Math.max(0, flat.length - 1));
    } else if (e.key === "Enter") {
      const place = flat[active];
      if (open && place) {
        e.preventDefault();
        choose(place);
      }
    } else if (e.key === "Escape" && !inline) {
      setOpen(false);
      setQuery("");
    }
  }

  const activeId = open && flat[active] ? `${id}-opt-${active}` : undefined;
  const showList = open || inline;

  return (
    <div className={cn("relative flex flex-col gap-1.5", className)}>
      {label && (
        <label htmlFor={`${id}-input`} className="text-xs font-medium text-muted-foreground">
          {label}
        </label>
      )}
      <div className={cn(FIELD_CLASS, "flex items-center gap-2 py-0 focus-within:border-accent focus-within:ring-3 focus-within:ring-accent/25", triggerClassName)}>
        <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-accent/15 text-accent-text">
          <MapPin className="size-4" aria-hidden="true" />
        </span>
        <input
          ref={inputRef}
          id={`${id}-input`}
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-activedescendant={activeId}
          aria-autocomplete="list"
          autoComplete="off"
          spellCheck={false}
          value={open ? query : value ? placeLabel(value) : ""}
          placeholder={open && value ? placeLabel(value) : t("location.placeholder")}
          onFocus={() => {
            setOpen(true);
            setActive(0);
          }}
          onBlur={() => {
            if (!inline) {
              setOpen(false);
              setQuery("");
            }
          }}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
            setOpen(true);
          }}
          onKeyDown={onKeyDown}
          className="h-11 min-w-0 flex-1 bg-transparent text-sm font-medium text-foreground outline-none placeholder:font-normal placeholder:text-muted-foreground"
        />
      </div>

      {showList && (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          aria-label={label ?? t("location.choose")}
          data-lenis-prevent
          className={cn(
            "max-h-72 overflow-y-auto overscroll-contain rounded-xl bg-popover p-1.5 text-popover-foreground ring-1 ring-border",
            inline ? "mt-1" : "absolute inset-x-0 top-full z-50 mt-1 shadow-lg animate-in fade-in slide-in-from-top-1 duration-150"
          )}
        >
          {nearYou && (
            <li
              role="option"
              id={`${id}-opt-0`}
              data-index={0}
              aria-selected={false}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choose(nearYou)}
              onMouseMove={() => setActive(0)}
              className={cn(
                "flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-sm",
                active === 0 ? "bg-muted" : ""
              )}
            >
              <LocateFixed className="size-4 shrink-0 text-accent-text" aria-hidden="true" />
              <span className="flex flex-col">
                <span className="text-xs text-muted-foreground">{t("location.nearYou")}</span>
                <span className="font-medium">{placeLabel(nearYou)}</span>
              </span>
            </li>
          )}

          {indexed.map((group) => (
            <li key={group.country_code} role="presentation">
              <p className="px-2.5 pb-1 pt-2 text-xs font-semibold text-muted-foreground">
                {group.country}
              </p>
              <ul role="presentation">
                {group.rows.map(({ place, index }) => {
                  const selected = place.id === value?.id;
                  return (
                    <li
                      key={place.id}
                      role="option"
                      id={`${id}-opt-${index}`}
                      data-index={index}
                      aria-selected={selected}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => choose(place)}
                      onMouseMove={() => setActive(index)}
                      className={cn(
                        "flex cursor-pointer items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-sm transition-colors",
                        active === index ? "bg-muted" : ""
                      )}
                    >
                      <span className="truncate">
                        <Highlighted text={placeLabel(place)} query={query} />
                      </span>
                      {selected && <Check className="size-4 shrink-0 text-accent-text" aria-hidden="true" />}
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}

          {flat.length === 0 && (
            <li role="presentation" className="flex flex-col items-center gap-1 px-3 py-6 text-center text-sm text-muted-foreground">
              <SearchX className="size-5" aria-hidden="true" />
              {t("location.empty", { query })}
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
