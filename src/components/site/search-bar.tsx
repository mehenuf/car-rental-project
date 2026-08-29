"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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
  const router = useRouter();
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
      setError("Please choose both a pick-up and drop-off date.");
      return;
    }
    if (dropoffDate <= pickupDate) {
      setError("Drop-off date must be after the pick-up date.");
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
            heading="Pick-Up"
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
            heading="Drop-Off"
            locations={locations ?? []}
            locationId={effectiveDropoff}
            onLocationChange={setDropoffLocationId}
            date={dropoffDate}
            onDateChange={setDropoffDate}
            minDate={pickupDate ?? today}
            time={dropoffTime}
            onTimeChange={setDropoffTime}
          />
          <div className="flex items-center justify-center p-(--space-sm) lg:pl-(--space-md)">
            <Button type="button" size="lg" className="w-full gap-2 lg:w-auto" onClick={handleSearch}>
              <Search className="size-4" />
              Search
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
  locations,
  locationId,
  onLocationChange,
  date,
  onDateChange,
  minDate,
  time,
  onTimeChange,
}: {
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
  return (
    <div className="flex flex-1 flex-col gap-(--space-sm) p-(--space-sm)">
      <span className="text-sm font-semibold text-accent">{heading}</span>
      <div className="grid grid-cols-1 gap-(--space-sm) sm:grid-cols-3">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">Location</span>
          <Select value={locationId} onValueChange={(value) => onLocationChange(value ?? "")}>
            <SelectTrigger className="h-auto w-full gap-2 border-0 p-0 shadow-none focus-visible:ring-0">
              <MapPin className="size-4 shrink-0 text-muted-foreground" />
              <SelectValue placeholder="Select your city">
                {(value: string | null) => {
                  const selected = locations.find((loc) => String(loc.id) === value);
                  return selected ? `${selected.city}, ${selected.country}` : "Select your city";
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

        <DatePickerField label="Date" value={date} onChange={onDateChange} minDate={minDate} />

        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">Time</span>
          <Select value={time} onValueChange={(value) => onTimeChange(value ?? time)}>
            <SelectTrigger className="h-auto w-full gap-2 border-0 p-0 shadow-none focus-visible:ring-0">
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
