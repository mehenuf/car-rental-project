"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { setPreferenceCookie } from "@/lib/client-cookie";
import { CONSENT_COOKIE, analyticsAllowed, encodeConsent } from "@/lib/consent";
import { useLocaleRouter, useT } from "@/lib/i18n/provider";
import { supabase } from "@/lib/supabase";

function currentAnalytics(): boolean {
  const raw = document.cookie.split("; ").find((c) => c.startsWith(`${CONSENT_COOKIE}=`))?.slice(CONSENT_COOKIE.length + 1);
  return analyticsAllowed(raw);
}

/** Download my data, change cookie consent, delete my account. */
export function PrivacyPanel({ email, accepted }: { email: string; accepted: { kind: string; version: string }[] }) {
  const t = useT();
  const router = useLocaleRouter();
  const [analytics, setAnalytics] = useState(false);
  useEffect(() => {
    // The consent cookie only exists in the browser, so it is read after mount to keep server and client markup equal.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAnalytics(currentAnalytics());
  }, []);
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  function saveConsent(value: boolean) {
    setPreferenceCookie(CONSENT_COOKIE, encodeConsent({ analytics: value }));
    setAnalytics(value);
    void fetch("/api/consent", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ analytics: value }) }).catch(() => undefined);
    setMessage({ text: t("privacy.saved"), ok: true });
  }

  async function erase(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/account/privacy/erase", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirm_email: confirm }) });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error?.message ?? t("privacy.error"));
      await supabase.auth.signOut();
      router.push("/");
      router.refresh();
    } catch (err) {
      setMessage({ text: err instanceof Error ? err.message : t("privacy.error"), ok: false });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-(--space-md)">
      <Card className="shadow-card ring-0">
        <CardContent className="flex flex-col gap-(--space-xs)">
          <h2 className="font-heading text-base font-semibold text-foreground">{t("privacy.downloadTitle")}</h2>
          <p className="text-sm text-muted-foreground">{t("privacy.downloadBody")}</p>
          <Button type="button" variant="outline" className="w-fit" render={<a href="/api/account/privacy/export" download />}>{t("privacy.download")}</Button>
        </CardContent>
      </Card>

      <Card className="shadow-card ring-0">
        <CardContent className="flex flex-col gap-(--space-xs)">
          <h2 className="font-heading text-base font-semibold text-foreground">{t("privacy.cookiesTitle")}</h2>
          <p className="text-sm text-muted-foreground">{t("privacy.cookiesBody")}</p>
          <div className="flex gap-2">
            <Button type="button" size="sm" variant={analytics ? "default" : "outline"} onClick={() => saveConsent(true)} aria-pressed={analytics}>{t("consent.accept")}</Button>
            <Button type="button" size="sm" variant={analytics ? "outline" : "default"} onClick={() => saveConsent(false)} aria-pressed={!analytics}>{t("consent.decline")}</Button>
          </div>
        </CardContent>
      </Card>

      {accepted.length > 0 && (
        <Card className="shadow-card ring-0">
          <CardContent className="flex flex-col gap-1">
            <h2 className="font-heading text-base font-semibold text-foreground">{t("privacy.acceptedTitle")}</h2>
            {accepted.map((a) => <p key={`${a.kind}-${a.version}`} className="text-sm text-muted-foreground">{a.kind} · {a.version}</p>)}
          </CardContent>
        </Card>
      )}

      <Card className="shadow-card ring-0">
        <CardContent className="flex flex-col gap-(--space-xs)">
          <h2 className="font-heading text-base font-semibold text-destructive">{t("privacy.deleteTitle")}</h2>
          <p className="text-sm text-muted-foreground">{t("privacy.deleteBody")}</p>
          <form onSubmit={erase} className="flex flex-col gap-2">
            <Label htmlFor="pv-confirm">{t("privacy.deleteConfirm", { email })}</Label>
            <Input id="pv-confirm" type="email" autoComplete="off" value={confirm} onChange={(e) => setConfirm(e.target.value)} className="max-w-sm" />
            <Button type="submit" variant="destructive" className="w-fit" disabled={busy || confirm.trim().toLowerCase() !== email.toLowerCase()}>{t("privacy.delete")}</Button>
          </form>
        </CardContent>
      </Card>

      {message && <p role={message.ok ? "status" : "alert"} className={`text-sm ${message.ok ? "text-success-text" : "text-destructive"}`}>{message.text}</p>}
    </div>
  );
}
