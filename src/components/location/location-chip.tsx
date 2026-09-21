"use client";

import { useState } from "react";
import { ChevronDown, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { PlaceCombobox } from "@/components/location/place-combobox";
import { useLocation } from "@/components/location/location-provider";
import { useT } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";

/** The header's "where am I renting" control: shows the current city and opens a search list. */
export function LocationChip({ className }: { className?: string }) {
  const t = useT();
  const { places, selected, detected, chosen, select, loading } = useLocation();
  const [open, setOpen] = useState(false);
  if (!loading && places.length === 0) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="sm"
            // Starts with the visible city so the name a voice-control user says matches what is on screen.
            aria-label={selected ? `${selected.city}, ${selected.country_code}. ${t("location.choose")}` : t("location.choose")}
            className={cn("max-w-44 gap-1.5 font-medium", className)}
          />
        }
      >
        <MapPin className="text-accent-text" aria-hidden="true" />
        <span className="hidden truncate sm:inline md:hidden lg:inline">
          {selected ? `${selected.city}, ${selected.country_code}` : loading ? "" : t("location.choose")}
        </span>
        <ChevronDown className={cn("hidden size-3.5 sm:block md:hidden lg:block text-muted-foreground transition-transform duration-(--motion-medium)", open && "rotate-180")} aria-hidden="true" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 max-w-[calc(100vw-1.5rem)] p-2">
        <p className="px-1 pb-2 text-xs text-muted-foreground">{!chosen && detected ? t("location.guessed") : t("location.choose")}</p>
        <PlaceCombobox
          inline
          autoFocus
          places={places}
          value={selected}
          detected={detected}
          onChange={(place) => {
            select(place);
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
