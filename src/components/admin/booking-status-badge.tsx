import { Badge } from "@/components/ui/badge";
import { BOOKING_STATUS_LABELS } from "@/lib/booking-state";
import { cn } from "@/lib/utils";
import type { BookingStatus } from "@/types/database";

const STATUS_STYLES: Record<BookingStatus, string> = {
  pending: "bg-muted text-muted-foreground",
  confirmed: "bg-info/15 text-info-text",
  active: "bg-info/15 text-info-text",
  completed: "bg-success/15 text-success-text",
  cancelled: "bg-destructive/15 text-destructive",
  no_show: "bg-destructive/15 text-destructive",
};

/** `label` replaces the English name (pages that have a language pass their own translation). */
export function BookingStatusBadge({ status, label }: { status: BookingStatus; label?: string }) {
  return (
    <Badge className={cn("border-0 gap-1.5", label && "capitalize", STATUS_STYLES[status])}>
      <span className="size-1.5 rounded-full bg-current" aria-hidden />
      {label ?? BOOKING_STATUS_LABELS[status]}
    </Badge>
  );
}
