"use client";

import { Link } from "@/lib/i18n/link";
import { useLocale, useT } from "@/lib/i18n/provider";
import { numberingLocale } from "@/lib/i18n/locales";
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

const STATUS_KEY: Record<Payout["status"], string> = { pending: "statusScheduled", paid: "statusPaid", frozen: "statusHold", cancelled: "statusCancelled" };

/** Earnings from completed rentals: what is scheduled, what is paid, and the booking behind each. */
export function PayoutsView({ individual }: { individual: boolean }) {
  const t = useT();
  const locale = useLocale();
  const result = useApiData<{
    currency: string;
    pending_minor: number;
    paid_minor: number;
    account: { account_last4: string; bank_name: string } | null;
    data: Payout[];
  }>("/api/provider/payouts");

  if (result.status === "loading") return <p className="text-sm text-muted-foreground">{t("portal.common.loading")}</p>;
  if (result.status === "error") return <p className="text-sm text-destructive">{result.error}</p>;
  const { currency, pending_minor, paid_minor, account, data } = result.data;
  const money = (minor: number, code: string) => formatMinor(minor, code, numberingLocale(locale));

  return (
    <div className="flex flex-col gap-(--space-md)">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-bold text-foreground">{individual ? t("portal.nav.earnings") : t("portal.nav.payouts")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("portal.payouts.intro")}
        </p>
      </div>

      <div className="grid gap-(--space-sm) sm:grid-cols-3">
        <Card className="shadow-card ring-0">
          <CardContent>
            <p className="text-sm text-muted-foreground">{t("portal.payouts.scheduled")}</p>
            <p className="font-heading text-xl font-bold text-foreground">{money(pending_minor, currency)}</p>
          </CardContent>
        </Card>
        <Card className="shadow-card ring-0">
          <CardContent>
            <p className="text-sm text-muted-foreground">{t("portal.payouts.paidOut")}</p>
            <p className="font-heading text-xl font-bold text-foreground">{money(paid_minor, currency)}</p>
          </CardContent>
        </Card>
        <Card className="shadow-card ring-0">
          <CardContent>
            <p className="text-sm text-muted-foreground">{t("portal.payouts.account")}</p>
            {account ? (
              <p className="font-medium text-foreground">
                {t("portal.payouts.ending", { bank: account.bank_name, last4: account.account_last4 })}
              </p>
            ) : (
              <p className="text-sm text-destructive">
                {t("portal.payouts.none")}{" "}
                <Link href="/provider/settings" className="underline">
                  {t("portal.payouts.addOne")}
                </Link>
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-card ring-0">
        <CardContent className="flex flex-col divide-y divide-border p-0">
          {data.length === 0 && <p className="p-(--space-sm) text-sm text-muted-foreground">{t("portal.payouts.empty")}</p>}
          {data.map((p) => (
            <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 p-(--space-sm) text-sm">
              <span className="flex flex-col">
                <span className="font-medium text-foreground">
                  {p.reference ?? t("portal.payouts.booking")} <span className="font-normal text-muted-foreground">{p.customer_name}</span>
                </span>
                <span className="text-muted-foreground">{p.status === "paid" && p.paid_at ? t("portal.payouts.paidOn", { date: formatDate(p.paid_at, locale) }) : t("portal.payouts.due", { date: formatDate(p.release_after, locale) })}</span>
              </span>
              <span className="flex items-center gap-3">
                <Badge variant="outline">{t(`portal.payouts.${STATUS_KEY[p.status]}`)}</Badge>
                <span className="font-medium text-foreground">{money(p.amount_minor, p.currency)}</span>
              </span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
