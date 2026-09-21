"use client";

import { useEffect, useState } from "react";
import type { Locale as DayPickerLocale } from "react-day-picker";
import { Calendar } from "@/components/ui/calendar";
import { loadCalendarLocale } from "@/lib/i18n/calendar-locale";
import { useLocale } from "@/lib/i18n/provider";

/** The calendar in the visitor's language. It shows a placeholder for the moment it takes to fetch that language. */
export default function LocalizedCalendar({
  selected,
  defaultMonth,
  onSelect,
  disabled,
}: {
  selected: Date | undefined;
  defaultMonth: Date | undefined;
  onSelect: (date: Date | undefined) => void;
  disabled?: { before: Date };
}) {
  const locale = useLocale();
  const [dayPickerLocale, setDayPickerLocale] = useState<DayPickerLocale | null>(null);

  useEffect(() => {
    let cancelled = false;
    void loadCalendarLocale(locale).then((loaded) => {
      if (!cancelled) setDayPickerLocale(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, [locale]);

  if (!dayPickerLocale) return <div className="h-[19rem] w-[17rem] animate-pulse rounded-xl bg-muted" aria-hidden="true" />;
  return (
    <Calendar
      mode="single"
      locale={dayPickerLocale}
      dir={locale === "ar" ? "rtl" : "ltr"}
      selected={selected}
      defaultMonth={defaultMonth}
      onSelect={onSelect}
      disabled={disabled}
    />
  );
}
