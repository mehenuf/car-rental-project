"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useApiData } from "@/hooks/use-api-data";
import { formatDate } from "@/lib/format";
import { formatMinor } from "@/lib/pricing/money";

interface Payout {
  id: string;
  reference: string | null;
  customer_name: string | null;
  amount_minor: number;
  currency: string;
  status: "pending" | "paid" | "frozen" | "cancelled";
  release_after: string;
  paid_at: string | null;
}

const STATUS_LABEL: Record<Payout["status"], string> = { pending: "Scheduled", paid: "Paid", frozen: "On hold", cancelled: "Cancelled" };

/** Earnings from completed rentals: what is scheduled, what is paid, and the booking behind each. */
export function PayoutsView({ individual }: { individual: boolean }) {
  const result = useApiData<{
    currency: string;
    pending_minor: number;
    paid_minor: number;
    account: { account_last4: string; bank_name: string } | null;
    data: Payout[];
  }>("/api/provider/payouts");

  if (result.status === "loading") return <p className="text-sm text-muted-foreground">Loading...</p>;
  if (result.status === "error") return <p className="text-sm text-destructive">{result.error}</p>;
  const { currency, pending_minor, paid_minor, account, data } = result.data;

  return (
    <div className="flex flex-col gap-(--space-md)">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-bold text-foreground">{individual ? "Earnings" : "Payouts"}</h1>
        <p className="text-sm text-muted-foreground">
          A payout is scheduled when a rental is returned and paid 48 hours later, unless a dispute puts it on hold. Payouts are simulated in this demo.
        </p>
      </div>

      <div className="grid gap-(--space-sm) sm:grid-cols-3">
        <Card className="shadow-card ring-0">
          <CardContent>
            <p className="text-sm text-muted-foreground">Scheduled</p>
            <p className="font-heading text-xl font-bold text-foreground">{formatMinor(pending_minor, currency)}</p>
          </CardContent>
        </Card>
        <Card className="shadow-card ring-0">
          <CardContent>
            <p className="text-sm text-muted-foreground">Paid out</p>
            <p className="font-heading text-xl font-bold text-foreground">{formatMinor(paid_minor, currency)}</p>
          </CardContent>
        </Card>
        <Card className="shadow-card ring-0">
          <CardContent>
            <p className="text-sm text-muted-foreground">Payout account</p>
            {account ? (
              <p className="font-medium text-foreground">
                {account.bank_name} ending {account.account_last4}
              </p>
            ) : (
              <p className="text-sm text-destructive">
                None yet.{" "}
                <Link href="/provider/settings" className="underline">
                  Add one
                </Link>
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-card ring-0">
        <CardContent className="flex flex-col divide-y divide-border p-0">
          {data.length === 0 && <p className="p-(--space-sm) text-sm text-muted-foreground">No payouts yet. They appear after your first completed rental.</p>}
          {data.map((p) => (
            <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 p-(--space-sm) text-sm">
              <span className="flex flex-col">
                <span className="font-medium text-foreground">
                  {p.reference ?? "Booking"} <span className="font-normal text-muted-foreground">{p.customer_name}</span>
                </span>
                <span className="text-muted-foreground">{p.status === "paid" && p.paid_at ? `Paid ${formatDate(p.paid_at)}` : `Due ${formatDate(p.release_after)}`}</span>
              </span>
              <span className="flex items-center gap-3">
                <Badge variant="outline">{STATUS_LABEL[p.status]}</Badge>
                <span className="font-medium text-foreground">{formatMinor(p.amount_minor, p.currency)}</span>
              </span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
