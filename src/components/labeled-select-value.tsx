"use client";

import { SelectValue } from "@/components/ui/select";

/**
 * Base UI's `Select.Value` only auto-resolves a display label when the
 * value and the item's rendered text happen to match — for any select
 * where they differ (an id, a slug, a combined sort key, etc.) it just
 * shows the raw value. This looks it up explicitly instead.
 */
export function LabeledSelectValue({
  options,
  placeholder = "Select...",
}: {
  options: { value: string; label: string }[];
  placeholder?: string;
}) {
  return (
    <SelectValue placeholder={placeholder}>
      {(value: string | null) => options.find((o) => o.value === value)?.label ?? placeholder}
    </SelectValue>
  );
}
