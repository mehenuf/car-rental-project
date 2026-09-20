"use client";

import { useState } from "react";
import { useLocaleRouter, useT } from "@/lib/i18n/provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

/** Offers to attach earlier guest bookings made with the account's verified email. */
export function ClaimBookings({ count }: { count: number }) {
  const t = useT();
  const router = useLocaleRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function claim() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/account/claim", { method: "POST" });
      const body = await res.json();
      if (!res.ok) throw new Error();
      setMessage(t("account.claimDone", { count: body.claimed as number }));
      setDone(true);
      router.refresh();
    } catch {
      setMessage(t("account.claimError"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="shadow-card ring-0">
      <CardContent className="flex flex-col gap-2">
        <h2 className="font-heading text-base font-semibold text-foreground">{t("account.claimTitle")}</h2>
        {!done && <p className="text-sm text-muted-foreground">{t("account.claimBody", { count })}</p>}
        {!done && (
          <Button type="button" size="sm" className="self-start" disabled={busy} onClick={claim}>
            {t("account.claimButton")}
          </Button>
        )}
        {message && <p role="status" className="text-sm text-muted-foreground">{message}</p>}
      </CardContent>
    </Card>
  );
}
