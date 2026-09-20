"use client";

import { useMemo, useState } from "react";
import { useLocaleRouter, useT } from "@/lib/i18n/provider";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DatePickerField } from "@/components/site/date-picker-field";
import { PlaceCombobox } from "@/components/location/place-combobox";
import { useLocation } from "@/components/location/location-provider";
import type { Place } from "@/lib/location/places";
import { TimeSelectField } from "@/components/site/time-select-field";
import { DEFAULT_TIME, combineDateAndTime } from "@/lib/booking-time";
import { toApiDate } from "@/lib/date-range";


function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export function SearchBar() {
  const router = useLocaleRouter();
  const t = useT();
  const { places, selected, detected, select } = useLocation();

  const today = useMemo(() => startOfToday(), []);
  const tomorrow = useMemo(() => {
    const d = new Date(today);
    d.setDate(d.getDate() + 1);
    return d;
  }, [today]);

  const [pickupPlace, setPickupPlace] = useState<Place | null>(null);
  const [dropoffPlace, setDropoffPlace] = useState<Place | null>(null);
  const [pickupDate, setPickupDate] = useState<Date | undefined>(today);
  const [dropoffDate, setDropoffDate] = useState<Date | undefined>(tomorrow);
  const [pickupTime, setPickupTime] = useState(DEFAULT_TIME);
  const [dropoffTime, setDropoffTime] = useState(DEFAULT_TIME);
  const [error, setError] = useState<string | null>(null);

  // Pick-up defaults to the place chosen in the header (or guessed for the visitor); drop-off defaults to pick-up.
  const pickup = pickupPlace ?? selected ?? places[0] ?? null;
  const dropoff = dropoffPlace ?? pickup;
  const effectivePickup = pickup ? String(pickup.id) : "";
  const effectiveDropoff = dropoff ? String(dropoff.id) : "";

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
    if (combineDateAndTime(dropoffDate, dropoffTime) <= combineDateAndTime(pickupDate, pickupTime)) {
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
            heading={t("search.pickUp")}
            places={places}
            place={pickup}
            onPlaceChange={(place) => {
              setPickupPlace(place);
              select(place);
            }}
            detected={detected}
            date={pickupDate}
            onDateChange={handlePickupDateChange}
            minDate={today}
            time={pickupTime}
            onTimeChange={setPickupTime}
          />
          <RentalLeg
            heading={t("search.dropOff")}
            places={places}
            place={dropoff}
            onPlaceChange={setDropoffPlace}
            detected={null}
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
  heading,
  places,
  place,
  onPlaceChange,
  detected,
  date,
  onDateChange,
  minDate,
  time,
  onTimeChange,
}: {
  heading: string;
  places: Place[];
  place: Place | null;
  onPlaceChange: (place: Place) => void;
  detected: Place | null;
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
        <PlaceCombobox label={t("search.location")} places={places} value={place} onChange={onPlaceChange} detected={detected} />

        <DatePickerField
          label={t("search.date")}
          value={date}
          onChange={onDateChange}
          minDate={minDate}
        />

<TimeSelectField label={t("search.time")} value={time} onChange={onTimeChange} />
      </div>
    </div>
  );
}
