import Link from "next/link";
import { Clock } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency, formatDate } from "@/lib/format";

export default async function BookingConfirmationPage({
  searchParams,
}: {
  searchParams: Promise<{
    ref?: string;
    car?: string;
    pickupDate?: string;
    dropoffDate?: string;
    total?: string;
  }>;
}) {
  const { ref, car, pickupDate, dropoffDate, total } = await searchParams;

  return (
    <div className="mx-auto flex max-w-lg flex-col items-center gap-(--space-md) px-(--space-sm) py-(--space-2xl) text-center">
      <div className="flex size-16 items-center justify-center rounded-full bg-accent/10 text-accent">
        <Clock className="size-8" />
      </div>
      <div className="flex flex-col gap-2">
        <h1 className="font-heading text-2xl font-bold text-foreground">Booking Received</h1>
        <p className="text-muted-foreground">
          Your booking{car ? ` for the ${car}` : ""} has been received and is awaiting
          confirmation. We&apos;ll email you as soon as it&apos;s confirmed — no payment has been
          taken yet.
        </p>
      </div>

      <Card className="w-full shadow-card ring-0">
        <CardContent className="flex flex-col gap-(--space-sm)">
          <Row label="Reference" value={ref ?? "—"} />
          <Row label="Vehicle" value={car ?? "—"} />
          <Row label="Pick-up" value={pickupDate ? formatDate(pickupDate) : "—"} />
          <Row label="Drop-off" value={dropoffDate ? formatDate(dropoffDate) : "—"} />
          <Row label="Total" value={total ? formatCurrency(Number(total)) : "—"} emphasize />
        </CardContent>
      </Card>

      <Link href="/cars" className={buttonVariants({ size: "lg" })}>
        Browse more cars
      </Link>
    </div>
  );
}

function Row({
  label,
  value,
  emphasize,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
}) {
  return (
    <div className="flex items-center justify-between border-b border-border pb-(--space-xs) text-left last:border-0 last:pb-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span
        className={
          emphasize
            ? "font-heading text-lg font-bold text-accent"
            : "font-medium text-foreground"
        }
      >
        {value}
      </span>
    </div>
  );
}
