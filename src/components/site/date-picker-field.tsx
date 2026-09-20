"use client";

import { useId, useState } from "react";
import { CalendarDays, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import dynamic from "next/dynamic";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { numberingLocale } from "@/lib/i18n/locales";
import { useLocale, useT } from "@/lib/i18n/provider";
import { calendarLocale } from "@/lib/i18n/calendar-locale";

// The calendar (and its per-language date data) is only needed once someone opens it, so it is loaded then, and
// started early when the pointer or focus reaches the field.
const loadCalendar = () => import("@/components/ui/calendar").then((mod) => mod.Calendar);
const Calendar = dynamic(loadCalendar, {
  ssr: false,
  loading: () => <div className="h-[19rem] w-[17rem] animate-pulse rounded-xl bg-muted" aria-hidden="true" />,
});

/** Shared look for the date and time fields, so both read as the same kind of control. */
export const FIELD_CLASS =
  "min-h-11 w-full rounded-lg border border-input bg-background px-3 py-2.5 shadow-xs transition-colors hover:border-accent hover:bg-background";

/**
 * A bordered field with a calendar icon and a chevron, so it reads as something to click. The calendar opens in a
 * popover. The chosen date is written with its weekday, which makes it easy to check at a glance.
 */
export function DatePickerField({
  label,
  value,
  onChange,
  minDate,
  placeholder,
  className,
  triggerClassName,
}: {
  label: string;
  value: Date | undefined;
  onChange: (date: Date | undefined) => void;
  /** Dates strictly before this are disabled. */
  minDate?: Date;
  placeholder?: string;
  className?: string;
  /** Extra classes for the trigger, for places that need a different fit. */
  triggerClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const t = useT();
  const locale = useLocale();
  const labelId = useId();
  const valueId = useId();

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <span id={labelId} className="text-xs font-medium text-muted-foreground">
        {label}
      </span>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <Button
              type="button"
              variant="outline"
              aria-labelledby={`${labelId} ${valueId}`}
              onPointerEnter={() => void loadCalendar()}
              onFocus={() => void loadCalendar()}
              className={cn(
                FIELD_CLASS,
                "h-auto justify-start gap-2 font-normal text-foreground aria-expanded:border-accent aria-expanded:ring-3 aria-expanded:ring-accent/25",
                triggerClassName
              )}
            />
          }
        >
          <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-accent/15 text-accent-text">
            <CalendarDays className="size-4" aria-hidden="true" />
          </span>
          <span id={valueId} className={cn("flex-1 truncate text-start text-sm", value ? "font-medium" : "text-muted-foreground")}>
            {value
              ? value.toLocaleDateString(locale === "en" ? "en-US" : numberingLocale(locale), {
                  weekday: "short",
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })
              : (placeholder ?? t("search.selectDate"))}
          </span>
          <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} aria-hidden="true" />
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-0">
          <Calendar
            mode="single"
            locale={calendarLocale(locale)}
            dir={locale === "ar" ? "rtl" : "ltr"}
            selected={value}
            defaultMonth={value ?? minDate}
            onSelect={(date) => {
              onChange(date);
              setOpen(false);
            }}
            disabled={minDate ? { before: minDate } : undefined}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
