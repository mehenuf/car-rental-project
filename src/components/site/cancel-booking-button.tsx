"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { formatMinor } from "@/lib/pricing/money";
import { useLocale, useT } from "@/lib/i18n/provider";
import { numberingLocale } from "@/lib/i18n/locales";

/** Two-step cancel: the first click asks for confirmation, the second cancels and reports the refund. */
export function CancelBookingButton({ bookingId, currency, paid }: { bookingId: string; currency: string | null; paid: boolean }) {
  const router = useRouter();
  const t = useT();
  const locale = useLocale();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function cancel() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/bookings/${bookingId}/cancel`, { method: "POST" });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error?.message ?? t("cancelBooking.failed"));
      if (body.refund_status === "failed") {
        setMessage(t("cancelBooking.refundFailed"));
      } else if (body.refund_minor > 0 && currency) {
        setMessage(t("cancelBooking.refunded", { amount: formatMinor(body.refund_minor, currency, numberingLocale(locale)) }));
      } else if (paid) {
        setMessage(t("cancelBooking.noRefund"));
      } else {
        setMessage(t("cancelBooking.cancelled"));
      }
      setConfirming(false);
      router.refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : t("cancelBooking.failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-1 sm:items-end">
      {confirming ? (
        <div className="flex gap-2">
          <Button type="button" variant="destructive" size="sm" disabled={busy} onClick={cancel}>
            {busy ? t("cancelBooking.busy") : t("cancelBooking.yes")}
          </Button>
          <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => setConfirming(false)}>
            {t("cancelBooking.keep")}
          </Button>
        </div>
      ) : (
        <Button type="button" variant="outline" size="sm" onClick={() => setConfirming(true)}>
          {t("cancelBooking.cancel")}
        </Button>
      )}
      {message && (
        <p role="status" className="max-w-56 text-xs text-muted-foreground sm:text-end">
          {message}
        </p>
      )}
    </div>
  );
}
