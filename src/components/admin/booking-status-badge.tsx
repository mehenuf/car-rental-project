import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { BookingStatus } from "@/types/database";

const STATUS_STYLES: Record<BookingStatus, string> = {
  success: "bg-success/15 text-success",
  pending: "bg-info/15 text-info",
  cancelled: "bg-destructive/15 text-destructive",
};

const STATUS_LABELS: Record<BookingStatus, string> = {
  success: "Success",
  pending: "Pending",
  cancelled: "Cancelled",
};

export function BookingStatusBadge({ status }: { status: BookingStatus }) {
  return (
    <Badge className={cn("border-0 gap-1.5", STATUS_STYLES[status])}>
      <span className="size-1.5 rounded-full bg-current" aria-hidden />
      {STATUS_LABELS[status]}
    </Badge>
  );
}
