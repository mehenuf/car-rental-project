"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { LabeledSelectValue } from "@/components/labeled-select-value";

const SORT_OPTIONS = [
  { value: "price_per_day:asc", label: "Price: Low to High" },
  { value: "price_per_day:desc", label: "Price: High to Low" },
  { value: "rating:desc", label: "Highest Rated" },
  { value: "created_at:desc", label: "Newest" },
];

export function CarsSortSelect({ value }: { value: string }) {
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
      <SelectTrigger className="ml-auto w-52">
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
