"use client";

import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { LabeledSelectValue } from "@/components/labeled-select-value";
import { numberingLocale } from "@/lib/i18n/locales";
import type { PriceScope } from "@/lib/price-scope";
import { useLocale, useT } from "@/lib/i18n/provider";
import type { Fuel, Transmission, VehicleCategory } from "@/types/database";

export const PRICE_MIN = 0;

export interface CarsFilters {
  categories: VehicleCategory[];
  minPrice: number;
  maxPrice: number;
  /** The price range at the place being viewed, in that place's currency. Null when no place is chosen: prices differ per place, so there is nothing to filter on. */
  priceScope: PriceScope | null;
  seats: number | null;
  transmission: Transmission | null;
  fuel: Fuel | null;
}

const CATEGORIES: VehicleCategory[] = ["popular", "large", "small", "exclusive"];

const SEATS_OPTIONS = [2, 4, 5, 7];

export function CarsFilterSidebar({
  filters,
  onCategoryToggle,
  onPriceCommit,
  onSeatsChange,
  onTransmissionChange,
  onFuelChange,
  onClear,
}: {
  filters: CarsFilters;
  onCategoryToggle: (category: VehicleCategory, checked: boolean) => void;
  onPriceCommit: (range: [number, number]) => void;
  onSeatsChange: (seats: number | null) => void;
  onTransmissionChange: (transmission: Transmission | null) => void;
  onFuelChange: (fuel: Fuel | null) => void;
  onClear: () => void;
}) {
  const t = useT();
  const locale = useLocale();
  const anyLabel = t("cars.any");
  const money = new Intl.NumberFormat(locale === "en" ? "en-US" : numberingLocale(locale), {
    style: "currency",
    currency: filters.priceScope?.currency ?? "USD",
    maximumFractionDigits: 0,
  });
  const [priceDraft, setPriceDraft] = useState<[number, number]>([
    filters.minPrice,
    filters.maxPrice,
  ]);

  // Keep the slider's live drag position synced when filters change
  // externally (e.g. "Clear filters" or the URL being edited directly).
  const [syncedFrom, setSyncedFrom] = useState(filters);
  if (syncedFrom !== filters) {
    setSyncedFrom(filters);
    setPriceDraft([filters.minPrice, filters.maxPrice]);
  }

  return (
    <div className="flex flex-col gap-(--space-lg)">
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-lg font-semibold text-foreground">{t("cars.filters")}</h2>
        <Button type="button" variant="ghost" size="sm" onClick={onClear}>
          {t("cars.clearAll")}
        </Button>
      </div>

      <div className="flex flex-col gap-(--space-xs)">
        <h3 className="text-sm font-semibold text-foreground">{t("cars.category")}</h3>
        <div className="flex flex-col gap-2.5">
          {CATEGORIES.map((category) => (
            <label key={category} className="flex items-center gap-2.5 text-sm text-foreground pointer-coarse:min-h-11">
              <Checkbox
                checked={filters.categories.includes(category)}
                onCheckedChange={(checked) => onCategoryToggle(category, checked === true)}
              />
              {t(`enums.category.${category}`)}
            </label>
          ))}
        </div>
      </div>

      {filters.priceScope ? (
        <div className="flex flex-col gap-(--space-xs)">
          <h3 className="text-sm font-semibold text-foreground">{t("cars.pricePerDay")}</h3>
          <Slider
            aria-label={t("cars.priceRange")}
            value={priceDraft}
            min={PRICE_MIN}
            max={filters.priceScope.max}
            step={filters.priceScope.step}
            onValueChange={(value) => setPriceDraft(value as [number, number])}
            onValueCommitted={(value) => onPriceCommit(value as [number, number])}
          />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{money.format(priceDraft[0])}</span>
            <span>{money.format(priceDraft[1])}</span>
          </div>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">{t("cars.priceNeedsPlace")}</p>
      )}

      <div className="flex flex-col gap-(--space-xs)">
        <h3 id="filter-seats-label" className="text-sm font-semibold text-foreground">
          {t("cars.seats")}
        </h3>
        <Select
          value={filters.seats ? String(filters.seats) : "any"}
          onValueChange={(value) => onSeatsChange(value === "any" ? null : Number(value))}
        >
          <SelectTrigger aria-labelledby="filter-seats-label" className="w-full">
            <LabeledSelectValue
              options={[
                { value: "any", label: anyLabel },
                ...SEATS_OPTIONS.map((n) => ({ value: String(n), label: t("cars.seatsOption", { count: n }) })),
              ]}
            />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="any">{anyLabel}</SelectItem>
            {SEATS_OPTIONS.map((n) => (
              <SelectItem key={n} value={String(n)}>
                {t("cars.seatsOption", { count: n })}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-(--space-xs)">
        <h3 id="filter-transmission-label" className="text-sm font-semibold text-foreground">
          {t("cars.transmission")}
        </h3>
        <Select
          value={filters.transmission ?? "any"}
          onValueChange={(value) =>
            onTransmissionChange(value === "any" ? null : (value as Transmission))
          }
        >
          <SelectTrigger aria-labelledby="filter-transmission-label" className="w-full">
            <LabeledSelectValue
              options={[
                { value: "any", label: anyLabel },
                { value: "automatic", label: t("enums.transmission.automatic") },
                { value: "manual", label: t("enums.transmission.manual") },
              ]}
            />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="any">{anyLabel}</SelectItem>
            <SelectItem value="automatic">{t("enums.transmission.automatic")}</SelectItem>
            <SelectItem value="manual">{t("enums.transmission.manual")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-(--space-xs)">
        <h3 id="filter-fuel-label" className="text-sm font-semibold text-foreground">
          {t("cars.fuel")}
        </h3>
        <Select
          value={filters.fuel ?? "any"}
          onValueChange={(value) => onFuelChange(value === "any" ? null : (value as Fuel))}
        >
          <SelectTrigger aria-labelledby="filter-fuel-label" className="w-full">
            <LabeledSelectValue
              options={[
                { value: "any", label: anyLabel },
                { value: "petrol", label: t("enums.fuel.petrol") },
                { value: "diesel", label: t("enums.fuel.diesel") },
                { value: "hybrid", label: t("enums.fuel.hybrid") },
                { value: "electric", label: t("enums.fuel.electric") },
              ]}
            />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="any">{anyLabel}</SelectItem>
            <SelectItem value="petrol">{t("enums.fuel.petrol")}</SelectItem>
            <SelectItem value="diesel">{t("enums.fuel.diesel")}</SelectItem>
            <SelectItem value="hybrid">{t("enums.fuel.hybrid")}</SelectItem>
            <SelectItem value="electric">{t("enums.fuel.electric")}</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
