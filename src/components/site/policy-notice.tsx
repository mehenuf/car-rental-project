"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Link } from "@/lib/i18n/link";
import { useLocaleRouter, useT } from "@/lib/i18n/provider";

/** Shown to a signed-in person when the terms or privacy policy changed since they last accepted. */
export function PolicyNotice() {
  const t = useT();
  const router = useLocaleRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  async function accept() {
    setBusy(true);
    setError(false);
    try {
      const res = await fetch("/api/account/policies", { method: "POST" });
      if (!res.ok) throw new Error();
      router.refresh();
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section role="region" aria-labelledby="policy-notice-title" className="flex flex-col gap-2 rounded-xl border border-border bg-card p-(--space-sm) shadow-card">
      <h2 id="policy-notice-title" className="font-heading text-base font-semibold text-foreground">{t("policy.title")}</h2>
      <p className="text-sm text-muted-foreground">{t("policy.body")}</p>
      <p className="flex gap-3 text-sm">
        <Link href="/terms" className="underline">{t("policy.terms")}</Link>
        <Link href="/privacy" className="underline">{t("policy.privacy")}</Link>
      </p>
      <Button type="button" className="w-fit" onClick={accept} disabled={busy}>{t("policy.accept")}</Button>
      {error && <p role="alert" className="text-sm text-destructive">{t("policy.error")}</p>}
    </section>
  );
}
