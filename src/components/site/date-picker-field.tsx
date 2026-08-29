"use client";

import { useState } from "react";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export function DatePickerField({
  label,
  value,
  onChange,
  minDate,
  placeholder = "Select date",
  className,
}: {
  label: string;
  value: Date | undefined;
  onChange: (date: Date | undefined) => void;
  /** Dates strictly before this are disabled. */
  minDate?: Date;
  placeholder?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              className="h-auto justify-start gap-2 px-0 py-0 font-normal text-foreground hover:bg-transparent"
            />
          }
        >
          <CalendarIcon className="size-4 shrink-0 text-muted-foreground" />
          <span className={cn("truncate text-sm", !value && "text-muted-foreground")}>
            {value
              ? value.toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" })
              : placeholder}
          </span>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-0">
          <Calendar
            mode="single"
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
