import { notFound, redirect } from "next/navigation";
import { PrintButton } from "@/components/site/print-button";
import { getReceipt } from "@/lib/account/trips";
import { readRequestIdentity } from "@/lib/guest";
import { getLocale, getT } from "@/lib/i18n/dictionary";
import { numberingLocale } from "@/lib/i18n/locales";
import { withLocale } from "@/lib/i18n/negotiate";
import { quoteLineLabel } from "@/lib/pricing/localize";
import { formatMinor } from "@/lib/pricing/money";
import type { QuoteLine } from "@/lib/pricing/types";
import { formatDate } from "@/lib/format";

export const metadata = { title: "Receipt" };

interface ReceiptSnapshot {
  reference: string;
  customerName: string;
  currency: string;
  amountMinor: number;
  method: string;
  quote?: { days?: number; lines?: QuoteLine[] };
}

export default async function ReceiptPage({ params }: { params: Promise<{ number: string }> }) {
  const { number } = await params;
  const locale = await getLocale();
  const t = await getT();
  const identity = await readRequestIdentity();
  if (!identity.userId) redirect(withLocale(locale, "/login"));

  const receipt = await getReceipt(identity.userId, decodeURIComponent(number));
  if (!receipt) notFound();
  const snap = receipt.snapshot as unknown as ReceiptSnapshot;
  const money = (minor: number) => formatMinor(minor, snap.currency, numberingLocale(locale));
  const days = snap.quote?.days ?? 1;

  return (
    <article className="mx-auto flex max-w-2xl flex-col gap-(--space-md) rounded-xl border border-border bg-card p-(--space-md) print:border-0 print:p-0">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">{t("receipt.title")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("receipt.number")} {receipt.number} · {t("receipt.issued")} {formatDate(receipt.issued_at, locale)}
          </p>
          <p className="text-sm text-muted-foreground">{t("trip.reference")}: {snap.reference}</p>
        </div>
        <PrintButton label={t("receipt.print")} />
      </header>

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-start text-muted-foreground">
            <th className="py-1 text-start font-medium">{t("receipt.item")}</th>
            <th className="py-1 text-end font-medium">{t("receipt.amount")}</th>
          </tr>
        </thead>
        <tbody>
          {(snap.quote?.lines ?? []).map((line, i) => (
            <tr key={`${line.kind}-${i}`} className="border-b border-border last:border-0">
              <td className={`py-1.5 ${line.included ? "italic text-muted-foreground" : ""}`}>{quoteLineLabel(line, days, t)}</td>
              <td className="py-1.5 text-end">{money(line.amountMinor)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td className="py-2 font-semibold">{t("trip.total")}</td>
            <td className="py-2 text-end font-heading text-lg font-bold">{money(snap.amountMinor)}</td>
          </tr>
        </tfoot>
      </table>

      <p className="text-xs text-muted-foreground">{t("receipt.note")}</p>
    </article>
  );
}
