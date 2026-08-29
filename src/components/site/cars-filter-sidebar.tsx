"use client";

import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { LabeledSelectValue } from "@/components/labeled-select-value";
import { formatCurrency } from "@/lib/format";
import type { Fuel, Transmission, VehicleCategory } from "@/types/database";

export const PRICE_MIN = 0;
export const PRICE_MAX = 300;

export interface CarsFilters {
  categories: VehicleCategory[];
  minPrice: number;
  maxPrice: number;
  seats: number | null;
  transmission: Transmission | null;
  fuel: Fuel | null;
}

const CATEGORY_OPTIONS: { label: string; value: VehicleCategory }[] = [
  { label: "Popular", value: "popular" },
  { label: "Large", value: "large" },
  { label: "Small", value: "small" },
  { label: "Exclusive", value: "exclusive" },
];

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
        <h2 className="font-heading text-lg font-semibold text-foreground">Filters</h2>
        <Button type="button" variant="ghost" size="sm" onClick={onClear}>
          Clear all
        </Button>
      </div>

      <div className="flex flex-col gap-(--space-xs)">
        <h3 className="text-sm font-semibold text-foreground">Category</h3>
        <div className="flex flex-col gap-2.5">
          {CATEGORY_OPTIONS.map((option) => (
            <label key={option.value} className="flex items-center gap-2.5 text-sm text-foreground">
              <Checkbox
                checked={filters.categories.includes(option.value)}
                onCheckedChange={(checked) => onCategoryToggle(option.value, checked === true)}
              />
              {option.label}
            </label>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-(--space-xs)">
        <h3 className="text-sm font-semibold text-foreground">Price per day</h3>
        <Slider
          value={priceDraft}
          min={PRICE_MIN}
          max={PRICE_MAX}
          step={10}
          onValueChange={(value) => setPriceDraft(value as [number, number])}
          onValueCommitted={(value) => onPriceCommit(value as [number, number])}
        />
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{formatCurrency(priceDraft[0])}</span>
          <span>{formatCurrency(priceDraft[1])}</span>
        </div>
      </div>

      <div className="flex flex-col gap-(--space-xs)">
        <h3 className="text-sm font-semibold text-foreground">Seats</h3>
        <Select
          value={filters.seats ? String(filters.seats) : "any"}
          onValueChange={(value) => onSeatsChange(value === "any" ? null : Number(value))}
        >
          <SelectTrigger className="w-full">
            <LabeledSelectValue
              options={[
                { value: "any", label: "Any" },
                ...SEATS_OPTIONS.map((n) => ({ value: String(n), label: `${n}+ seats` })),
              ]}
            />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="any">Any</SelectItem>
            {SEATS_OPTIONS.map((n) => (
              <SelectItem key={n} value={String(n)}>
                {n}+ seats
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-(--space-xs)">
        <h3 className="text-sm font-semibold text-foreground">Transmission</h3>
        <Select
          value={filters.transmission ?? "any"}
          onValueChange={(value) =>
            onTransmissionChange(value === "any" ? null : (value as Transmission))
          }
        >
          <SelectTrigger className="w-full">
            <LabeledSelectValue
              options={[
                { value: "any", label: "Any" },
                { value: "automatic", label: "Automatic" },
                { value: "manual", label: "Manual" },
              ]}
            />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="any">Any</SelectItem>
            <SelectItem value="automatic">Automatic</SelectItem>
            <SelectItem value="manual">Manual</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-(--space-xs)">
        <h3 className="text-sm font-semibold text-foreground">Fuel Type</h3>
        <Select
          value={filters.fuel ?? "any"}
          onValueChange={(value) => onFuelChange(value === "any" ? null : (value as Fuel))}
        >
          <SelectTrigger className="w-full">
            <LabeledSelectValue
              options={[
                { value: "any", label: "Any" },
                { value: "petrol", label: "Petrol" },
                { value: "diesel", label: "Diesel" },
                { value: "hybrid", label: "Hybrid" },
                { value: "electric", label: "Electric" },
              ]}
            />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="any">Any</SelectItem>
            <SelectItem value="petrol">Petrol</SelectItem>
            <SelectItem value="diesel">Diesel</SelectItem>
            <SelectItem value="hybrid">Hybrid</SelectItem>
            <SelectItem value="electric">Electric</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
