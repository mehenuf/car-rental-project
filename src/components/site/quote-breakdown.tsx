"use client";

import { numberingLocale } from "@/lib/i18n/locales";
import { useLocale, useT } from "@/lib/i18n/provider";
import { describeCancellationT, quoteLineLabel } from "@/lib/pricing/localize";
import { formatMinor } from "@/lib/pricing/money";
import type { Quote } from "@/lib/pricing/types";
import { cn } from "@/lib/utils";

/** The itemised, all-inclusive price for a trip: every mandatory fee and tax is in the total. */
export function QuoteBreakdown({ quote, isUpdating }: { quote: Quote; isUpdating?: boolean }) {
  const t = useT();
  const locale = useLocale();
  const money = (minor: number) => formatMinor(minor, quote.currency, numberingLocale(locale));

  return (
    <div data-chat-avoid className={cn("flex flex-col gap-2 transition-opacity", isUpdating && "opacity-60")} aria-busy={isUpdating}>
      <ul className="flex flex-col gap-1.5 border-t border-border pt-(--space-sm) text-sm">
        {quote.lines.map((line, index) => (
          <li key={`${line.kind}-${line.code ?? index}`} className="flex items-start justify-between gap-3">
            <span className={cn("text-muted-foreground", line.included && "italic")}>{quoteLineLabel(line, quote.days, t)}</span>
            <span
              className={cn(
                "shrink-0 font-medium text-foreground",
                line.amountMinor < 0 && "text-success-text",
                line.included && "text-muted-foreground"
              )}
            >
              {money(line.amountMinor)}
            </span>
          </li>
        ))}
      </ul>

      <div className="flex items-center justify-between border-t border-border pt-(--space-sm)">
        <span className="font-heading text-base font-semibold text-foreground">{t("quote.total")}</span>
        <span className="font-heading text-xl font-bold text-accent-text">{money(quote.totalMinor)}</span>
      </div>
      <p className="text-xs text-muted-foreground">{t("quote.allIncluded")}</p>

      {quote.depositMinor > 0 && (
        <p className="text-xs text-muted-foreground">
          {t("quote.deposit", { amount: money(quote.depositMinor) })}
        </p>
      )}

      <ul className="flex flex-col gap-0.5 text-xs text-muted-foreground">
        {describeCancellationT(quote.cancellationTiers, t).map((text) => (
          <li key={text}>{text}</li>
        ))}
      </ul>
    </div>
  );
}
