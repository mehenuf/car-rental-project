"use client";

import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

/** Read-only stars, for display next to a numeric value. */
export function StarsDisplay({ value, label, className }: { value: number; label: string; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-0.5", className)} role="img" aria-label={label}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} className={cn("size-4", n <= Math.round(value) ? "fill-accent text-accent" : "text-muted-foreground/40")} aria-hidden />
      ))}
    </span>
  );
}

/** An accessible 1 to 5 picker: a radio group of star buttons. */
export function StarPicker({
  label,
  value,
  onChange,
  valueLabel,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  /** Spoken name for a value, for example "3 out of 5". */
  valueLabel: (value: number) => string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={valueLabel(n)}
          onClick={() => onChange(n)}
          className="flex size-9 items-center justify-center rounded-md hover:bg-muted"
        >
          <Star className={cn("size-5", n <= value ? "fill-accent text-accent" : "text-muted-foreground/50")} aria-hidden />
        </button>
      ))}
    </div>
  );
}
