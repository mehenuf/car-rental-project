"use client";

import { useState } from "react";
import type { DateRange as RdpDateRange } from "react-day-picker";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatRangeLabel, lastNDays, thisYear, today, type DateRange } from "@/lib/date-range";

const PRESETS: { label: string; getValue: () => DateRange }[] = [
  { label: "Today", getValue: today },
  { label: "Last 7 days", getValue: () => lastNDays(7) },
  { label: "Last 30 days", getValue: () => lastNDays(30) },
  { label: "This year", getValue: thisYear },
];

export function DateRangePicker({
  value,
  onChange,
}: {
  value: DateRange;
  onChange: (range: DateRange) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<RdpDateRange | undefined>({
    from: value.from,
    to: value.to,
  });

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setDraft({ from: value.from, to: value.to });
      }}
    >
      <PopoverTrigger render={<Button type="button" variant="outline" className="gap-2 font-normal" />}>
        <CalendarIcon className="size-4 text-muted-foreground" />
        {formatRangeLabel(value)}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-auto p-0">
        <div className="flex flex-col sm:flex-row">
          <div className="flex shrink-0 flex-col gap-0.5 border-b border-border p-(--space-2xs) sm:w-40 sm:border-r sm:border-b-0">
            {PRESETS.map((preset) => (
              <Button
                key={preset.label}
                type="button"
                variant="ghost"
                size="sm"
                className="justify-start"
                onClick={() => {
                  const range = preset.getValue();
                  onChange(range);
                  setOpen(false);
                }}
              >
                {preset.label}
              </Button>
            ))}
          </div>
          <div className="flex flex-col p-(--space-2xs)">
            <Calendar
              mode="range"
              numberOfMonths={2}
              selected={draft}
              defaultMonth={value.from}
              onSelect={(range) => setDraft(range)}
            />
            <div className="flex justify-end gap-2 border-t border-border pt-(--space-2xs)">
              <Button
                type="button"
                size="sm"
                disabled={!draft?.from || !draft?.to}
                onClick={() => {
                  if (draft?.from && draft?.to) {
                    onChange({ from: draft.from, to: draft.to });
                  }
                  setOpen(false);
                }}
              >
                Apply
              </Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
