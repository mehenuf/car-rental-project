"use client";

import { useId } from "react";
import { Clock } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TIME_SLOTS, formatSlot } from "@/lib/booking-time";
import { cn } from "@/lib/utils";
import { numberingLocale } from "@/lib/i18n/locales";
import { useLocale } from "@/lib/i18n/provider";
import { FIELD_CLASS } from "@/components/site/date-picker-field";

/** The time of day, in half-hour steps, written for the visitor's language. Looks like the date field beside it. */
export function TimeSelectField({
  label,
  value,
  onChange,
  disabledBefore,
  className,
}: {
  label: string;
  /** "HH:MM" */
  value: string;
  onChange: (time: string) => void;
  /** Slots earlier than this are not offered (for example times that have already passed today). */
  disabledBefore?: string;
  className?: string;
}) {
  const locale = useLocale();
  const tag = locale === "en" ? "en-US" : numberingLocale(locale);
  const labelId = useId();
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <span id={labelId} className="text-xs font-medium text-muted-foreground">
        {label}
      </span>
      <Select value={value} onValueChange={(next) => onChange(next ?? value)}>
        <SelectTrigger aria-labelledby={labelId} className={cn(FIELD_CLASS, "h-auto gap-2 font-medium text-foreground")}>
          <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-accent/15 text-accent-text">
            <Clock className="size-4" aria-hidden="true" />
          </span>
          <SelectValue>{(slot: string | null) => (slot ? formatSlot(slot, tag) : "")}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {TIME_SLOTS.map((slot) => (
            <SelectItem key={slot} value={slot} disabled={Boolean(disabledBefore && slot < disabledBefore)}>
              {formatSlot(slot, tag)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
