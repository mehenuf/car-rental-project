"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { formatMinor } from "@/lib/pricing/money";

/** Two-step cancel: the first click asks for confirmation, the second cancels and reports the refund. */
export function CancelBookingButton({ bookingId, currency, paid }: { bookingId: string; currency: string | null; paid: boolean }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function cancel() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/bookings/${bookingId}/cancel`, { method: "POST" });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error?.message ?? "Could not cancel this booking.");
      if (body.refund_status === "failed") {
        setMessage("Cancelled. Your refund could not be processed automatically; our team will follow up.");
      } else if (body.refund_minor > 0 && currency) {
        setMessage(`Cancelled. ${formatMinor(body.refund_minor, currency)} will be refunded.`);
      } else if (paid) {
        setMessage("Cancelled. This cancellation is outside the refund window, so no refund is due.");
      } else {
        setMessage("Cancelled.");
      }
      setConfirming(false);
      router.refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not cancel this booking.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-1 sm:items-end">
      {confirming ? (
        <div className="flex gap-2">
          <Button type="button" variant="destructive" size="sm" disabled={busy} onClick={cancel}>
            {busy ? "Cancelling..." : "Yes, cancel booking"}
          </Button>
          <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => setConfirming(false)}>
            Keep it
          </Button>
        </div>
      ) : (
        <Button type="button" variant="outline" size="sm" onClick={() => setConfirming(true)}>
          Cancel booking
        </Button>
      )}
      {message && (
        <p role="status" className="max-w-56 text-xs text-muted-foreground sm:text-right">
          {message}
        </p>
      )}
    </div>
  );
}
