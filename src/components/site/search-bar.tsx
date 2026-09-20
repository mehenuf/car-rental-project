"use client";

import { useMemo, useState } from "react";
import { useLocaleRouter, useT } from "@/lib/i18n/provider";
import { MapPin, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DatePickerField } from "@/components/site/date-picker-field";
import { useApiData } from "@/hooks/use-api-data";
import { toApiDate } from "@/lib/date-range";

interface Location {
  id: number;
  city: string;
  country: string;
  country_code: string;
}

const TIME_OPTIONS = Array.from({ length: 29 }, (_, i) => {
  const totalMinutes = 6 * 60 + i * 30; // 06:00 -> 20:00
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${String(h12).padStart(2, "0")}:${String(m).padStart(2, "0")} ${period}`;
});

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export function SearchBar() {
  const router = useLocaleRouter();
  const t = useT();
  const { data: locations } = useApiData<Location[]>("/api/locations");

  const today = useMemo(() => startOfToday(), []);
  const tomorrow = useMemo(() => {
    const d = new Date(today);
    d.setDate(d.getDate() + 1);
    return d;
  }, [today]);

  const [pickupLocationId, setPickupLocationId] = useState("");
  const [dropoffLocationId, setDropoffLocationId] = useState("");
  const [pickupDate, setPickupDate] = useState<Date | undefined>(today);
  const [dropoffDate, setDropoffDate] = useState<Date | undefined>(tomorrow);
  const [pickupTime, setPickupTime] = useState("10:00 AM");
  const [dropoffTime, setDropoffTime] = useState("10:00 AM");
  const [error, setError] = useState<string | null>(null);

  const firstLocationId = locations?.[0] ? String(locations[0].id) : "";
  const effectivePickup = pickupLocationId || firstLocationId;
  const effectiveDropoff = dropoffLocationId || firstLocationId;

  function handlePickupDateChange(date: Date | undefined) {
    setPickupDate(date);
    if (date && dropoffDate && dropoffDate <= date) {
      const next = new Date(date);
      next.setDate(next.getDate() + 1);
      setDropoffDate(next);
    }
  }

  function handleSearch() {
    if (!pickupDate || !dropoffDate) {
      setError(t("search.errBothDates"));
      return;
    }
    if (dropoffDate <= pickupDate) {
      setError(t("search.errDropAfter"));
      return;
    }
    setError(null);

    const params = new URLSearchParams();
    if (effectivePickup) params.set("pickupLocationId", effectivePickup);
    if (effectiveDropoff) params.set("dropoffLocationId", effectiveDropoff);
    params.set("pickupDate", toApiDate(pickupDate));
    params.set("dropoffDate", toApiDate(dropoffDate));
    params.set("pickupTime", pickupTime);
    params.set("dropoffTime", dropoffTime);
    router.push(`/cars?${params.toString()}`);
  }

  return (
    <div id="search-bar" className="relative z-10 mx-auto -mt-10 max-w-6xl px-(--space-sm) sm:-mt-14">
      <Card className="shadow-card ring-0">
        <div className="flex flex-col divide-y divide-border lg:flex-row lg:divide-x lg:divide-y-0">
          <RentalLeg
            id="pickup"
            heading={t("search.pickUp")}
            locations={locations ?? []}
            locationId={effectivePickup}
            onLocationChange={setPickupLocationId}
            date={pickupDate}
            onDateChange={handlePickupDateChange}
            minDate={today}
            time={pickupTime}
            onTimeChange={setPickupTime}
          />
          <RentalLeg
            id="dropoff"
            heading={t("search.dropOff")}
            locations={locations ?? []}
            locationId={effectiveDropoff}
            onLocationChange={setDropoffLocationId}
            date={dropoffDate}
            onDateChange={setDropoffDate}
            minDate={pickupDate ?? today}
            time={dropoffTime}
            onTimeChange={setDropoffTime}
          />
          {/* items-end, not items-center: each leg's heading label sits above
              its Location/Date/Time row, so centering against the whole
              (taller) stretched column height would leave the button
              floating above the row it belongs next to. Bottom-aligning
              (both this wrapper and each leg share the same p-(--space-sm))
              lines the button up with that row instead. */}
          <div className="flex items-end justify-center p-(--space-sm) lg:ps-(--space-md)">
            <Button type="button" size="lg" className="w-full gap-2 lg:w-auto" onClick={handleSearch}>
              <Search className="size-4" />
              {t("search.submit")}
            </Button>
          </div>
        </div>
      </Card>
      {error && <p className="mt-2 text-center text-sm text-destructive">{error}</p>}
    </div>
  );
}

function RentalLeg({
  id,
  heading,
  locations,
  locationId,
  onLocationChange,
  date,
  onDateChange,
  minDate,
  time,
  onTimeChange,
}: {
  id: string;
  heading: string;
  locations: Location[];
  locationId: string;
  onLocationChange: (id: string) => void;
  date: Date | undefined;
  onDateChange: (date: Date | undefined) => void;
  minDate: Date;
  time: string;
  onTimeChange: (time: string) => void;
}) {
  const t = useT();
  return (
    <div className="flex flex-1 flex-col gap-(--space-sm) p-(--space-sm)">
      <span className="text-sm font-semibold text-accent-text">{heading}</span>
      <div className="grid grid-cols-1 gap-(--space-sm) sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <span id={`${id}-location-label`} className="text-xs font-medium text-muted-foreground">
            {t("search.location")}
          </span>
          <Select value={locationId} onValueChange={(value) => onLocationChange(value ?? "")}>
            <SelectTrigger
              aria-labelledby={`${id}-location-label`}
              className="h-auto min-h-11 w-full gap-2 rounded-lg border border-border bg-background/60 px-3 py-2.5 shadow-none hover:bg-background"
            >
              <MapPin className="size-4 shrink-0 text-muted-foreground" />
              {/* Full "City, Country" only in the open list, where there's
                  room — the closed trigger uses the 2-letter country code
                  so a long name (e.g. "United Arab Emirates") never
                  truncates mid-word against the chevron. */}
              <SelectValue placeholder={t("search.selectCity")}>
                {(value: string | null) => {
                  const selected = locations.find((loc) => String(loc.id) === value);
                  return selected
                    ? `${selected.city}, ${selected.country_code.toUpperCase()}`
                    : t("search.selectCity");
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {locations.map((loc) => (
                <SelectItem key={loc.id} value={String(loc.id)}>
                  {loc.city}, {loc.country}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <DatePickerField
          label={t("search.date")}
          value={date}
          onChange={onDateChange}
          minDate={minDate}
          className="gap-1.5"
          triggerClassName="w-full rounded-lg border border-border bg-background/60 px-3 py-2.5 hover:bg-background hover:text-foreground"
        />

        <div className="flex flex-col gap-1.5">
          <span id={`${id}-time-label`} className="text-xs font-medium text-muted-foreground">
            {t("search.time")}
          </span>
          <Select value={time} onValueChange={(value) => onTimeChange(value ?? time)}>
            <SelectTrigger
              aria-labelledby={`${id}-time-label`}
              className="h-auto min-h-11 w-full gap-2 rounded-lg border border-border bg-background/60 px-3 py-2.5 shadow-none hover:bg-background"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIME_OPTIONS.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
