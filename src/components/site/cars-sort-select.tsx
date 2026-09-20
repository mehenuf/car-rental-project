"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { LabeledSelectValue } from "@/components/labeled-select-value";
import { useT } from "@/lib/i18n/provider";

export function CarsSortSelect({ value }: { value: string }) {
  const t = useT();
  const SORT_OPTIONS = [
    { value: "price_per_day:asc", label: t("cars.sortPriceAsc") },
    { value: "price_per_day:desc", label: t("cars.sortPriceDesc") },
    { value: "rating:desc", label: t("cars.sortRating") },
    { value: "created_at:desc", label: t("cars.sortNewest") },
  ];
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function handleChange(sort: string | null) {
    if (!sort) return;
    const [sortBy, sortOrder] = sort.split(":");
    if (!sortBy || !sortOrder) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("sortBy", sortBy);
    params.set("sortOrder", sortOrder);
    params.delete("page");
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <Select value={value} onValueChange={handleChange}>
      <SelectTrigger className="ms-auto w-52">
        <LabeledSelectValue options={SORT_OPTIONS} />
      </SelectTrigger>
      <SelectContent>
        {SORT_OPTIONS.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
