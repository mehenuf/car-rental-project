import { describeCancellation } from "@/lib/pricing/format";
import { formatMinor } from "@/lib/pricing/money";
import type { Quote } from "@/lib/pricing/types";
import { cn } from "@/lib/utils";

/** The itemised, all-inclusive price for a trip: every mandatory fee and tax is in the total. */
export function QuoteBreakdown({ quote, isUpdating }: { quote: Quote; isUpdating?: boolean }) {
  const money = (minor: number) => formatMinor(minor, quote.currency);

  return (
    <div className={cn("flex flex-col gap-2 transition-opacity", isUpdating && "opacity-60")} aria-busy={isUpdating}>
      <ul className="flex flex-col gap-1.5 border-t border-border pt-(--space-sm) text-sm">
        {quote.lines.map((line, index) => (
          <li key={`${line.kind}-${line.code ?? index}`} className="flex items-start justify-between gap-3">
            <span className={cn("text-muted-foreground", line.included && "italic")}>{line.label}</span>
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
        <span className="font-heading text-base font-semibold text-foreground">Total</span>
        <span className="font-heading text-xl font-bold text-accent-text">{money(quote.totalMinor)}</span>
      </div>
      <p className="text-xs text-muted-foreground">All mandatory fees and taxes are included in this total.</p>

      {quote.depositMinor > 0 && (
        <p className="text-xs text-muted-foreground">
          A refundable deposit of {money(quote.depositMinor)} is held at pick-up. It is not part of the total.
        </p>
      )}

      <ul className="flex flex-col gap-0.5 text-xs text-muted-foreground">
        {describeCancellation(quote.cancellationTiers).map((text) => (
          <li key={text}>{text}</li>
        ))}
      </ul>
    </div>
  );
}
