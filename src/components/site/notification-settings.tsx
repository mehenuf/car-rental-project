"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useApiData } from "@/hooks/use-api-data";
import { useLocale, useT } from "@/lib/i18n/provider";

type Category = "reminders" | "messages";
type Channel = "email" | "sms" | "push";

interface Settings {
  preferences: { category: Category; channel: Channel; enabled: boolean }[];
  contact: { phone_e164: string | null; phone_verified_at: string | null; sms_opt_in: boolean; timezone: string } | null;
  pushDevices: number;
  pushConfigured: boolean;
  vapidPublicKey: string | null;
}

function urlBase64ToUint8Array(value: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const raw = atob((value + padding).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export function NotificationSettings() {
  const t = useT();
  const locale = useLocale();
  const [refresh, setRefresh] = useState(0);
  const result = useApiData<Settings>(`/api/account/notifications?_r=${refresh}`);
  const settings = result.status === "success" ? result.data : null;
  const load = async () => setRefresh((n) => n + 1);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [pushState, setPushState] = useState<"unsupported" | "denied" | "off" | "on">("off");

  useEffect(() => {
    void (async () => {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) return setPushState("unsupported");
      if (Notification.permission === "denied") return setPushState("denied");
      const reg = await navigator.serviceWorker.getRegistration("/sw.js");
      const sub = await reg?.pushManager.getSubscription();
      setPushState(sub ? "on" : "off");
    })();
  }, []);

  const enabled = (category: Category, channel: Channel) => {
    const saved = settings?.preferences.find((p) => p.category === category && p.channel === channel);
    if (saved) return saved.enabled;
    return channel === "email"; // email defaults on; text and push are off until chosen
  };

  async function call(url: string, method: string, body: unknown, ok?: string) {
    setMessage(null);
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      setMessage({ text: json?.error?.message ?? t("notify.error"), ok: false });
      return false;
    }
    if (ok) setMessage({ text: ok, ok: true });
    return true;
  }

  async function toggle(category: Category, channel: Channel, value: boolean) {
    if (await call("/api/account/notifications", "PUT", { preferences: { [category]: { [channel]: value } } }, t("notify.saved"))) await load();
  }

  async function startPhone(e: FormEvent) {
    e.preventDefault();
    if (await call("/api/account/notifications/phone", "POST", { phone })) setCodeSent(true);
  }

  async function verifyPhone(e: FormEvent) {
    e.preventDefault();
    if (await call("/api/account/notifications/phone", "PUT", { code }, t("notify.verified"))) {
      setCodeSent(false);
      await load();
    }
  }

  async function enablePush() {
    if (!settings?.vapidPublicKey) return;
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return setPushState(permission === "denied" ? "denied" : "off");
    const reg = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(settings.vapidPublicKey) });
    if (await call("/api/account/push", "POST", sub.toJSON())) {
      setPushState("on");
      await load();
    }
  }

  async function disablePush() {
    const reg = await navigator.serviceWorker.getRegistration("/sw.js");
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      await call("/api/account/push", "DELETE", { endpoint: sub.endpoint });
      await sub.unsubscribe();
    }
    setPushState("off");
    await load();
  }

  const channels: { key: Channel; label: string }[] = [
    { key: "email", label: t("notify.email") },
    { key: "sms", label: t("notify.sms") },
    { key: "push", label: t("notify.push") },
  ];
  const categories: { key: Category; label: string }[] = [
    { key: "reminders", label: t("notify.reminders") },
    { key: "messages", label: t("notify.messagesCat") },
  ];
  const verified = Boolean(settings?.contact?.phone_verified_at);

  // Until the saved choices arrive, the defaults would look like the visitor's own settings.
  if (result.status === "error") return <p role="alert" className="text-sm text-destructive">{t("messages.loadFailed")}</p>;
  if (result.status !== "success") return <Skeleton aria-hidden="true" className="h-64 w-full rounded-xl" />;

  return (
    <div className="flex flex-col gap-(--space-md)">
      <Card className="shadow-card ring-0">
        <CardContent className="flex flex-col gap-(--space-sm)">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="py-1 text-start font-medium" />
                {channels.map((c) => <th key={c.key} className="py-1 text-center font-medium text-muted-foreground">{c.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {categories.map((cat) => (
                <tr key={cat.key} className="border-t border-border">
                  <th scope="row" className="py-2 text-start font-normal text-foreground">{cat.label}</th>
                  {channels.map((c) => {
                    // Text messages exist only for reminders, and only with a verified phone.
                    const unavailable = (c.key === "sms" && (cat.key !== "reminders" || !verified)) || (c.key === "push" && pushState !== "on");
                    return (
                      <td key={c.key} className="py-2 text-center">
                        <Checkbox
                          aria-label={`${cat.label}: ${c.label}`}
                          checked={enabled(cat.key, c.key)}
                          disabled={unavailable}
                          onCheckedChange={(v) => void toggle(cat.key, c.key, v === true)}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card className="shadow-card ring-0">
        <CardContent className="flex flex-col gap-(--space-xs)">
          <h2 className="font-heading text-base font-semibold text-foreground">{t("notify.phoneTitle")}</h2>
          {verified ? (
            <p className="text-sm text-success-text">{settings?.contact?.phone_e164} · {t("notify.verified")}</p>
          ) : codeSent ? (
            <form onSubmit={verifyPhone} className="flex flex-wrap items-end gap-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ph-code">{t("notify.code")}</Label>
                <Input id="ph-code" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} maxLength={8} required />
              </div>
              <Button type="submit" size="sm">{t("notify.verify")}</Button>
            </form>
          ) : (
            <form onSubmit={startPhone} className="flex flex-wrap items-end gap-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ph-number">{t("notify.phoneLabel")}</Label>
                <Input id="ph-number" type="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+44 7700 900123" required />
              </div>
              <Button type="submit" size="sm">{t("notify.sendCode")}</Button>
            </form>
          )}
          {verified && (
            <label className="flex items-start gap-2 text-sm text-foreground">
              <Checkbox
                checked={Boolean(settings?.contact?.sms_opt_in)}
                onCheckedChange={(v) => void (async () => { if (await call("/api/account/notifications", "PUT", { sms_opt_in: v === true }, t("notify.saved"))) await load(); })()}
                aria-label={t("notify.smsOptIn")}
              />
              <span>{t("notify.smsOptIn")}</span>
            </label>
          )}
          <p className="text-xs text-muted-foreground">{t("notify.smsNote")}</p>
        </CardContent>
      </Card>

      <Card className="shadow-card ring-0">
        <CardContent className="flex flex-col gap-(--space-xs)">
          <h2 className="font-heading text-base font-semibold text-foreground">{t("notify.pushTitle")}</h2>
          <p className="text-sm text-muted-foreground">{t("notify.pushBody")}</p>
          {!settings?.pushConfigured ? (
            <p className="text-sm text-muted-foreground">{t("notify.pushNotConfigured")}</p>
          ) : pushState === "unsupported" ? (
            <p className="text-sm text-muted-foreground">{t("notify.pushUnsupported")} {t("notify.pushIos")}</p>
          ) : pushState === "denied" ? (
            <p className="text-sm text-muted-foreground">{t("notify.pushDenied")}</p>
          ) : pushState === "on" ? (
            <Button type="button" variant="outline" size="sm" className="w-fit" onClick={() => void disablePush()}>{t("notify.pushDisable")}</Button>
          ) : (
            <Button type="button" size="sm" className="w-fit" onClick={() => void enablePush()}>{t("notify.pushEnable")}</Button>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="tz">{t("notify.timezone")}</Label>
        <Input
          id="tz"
          key={settings?.contact?.timezone ?? "tz"}
          defaultValue={settings?.contact?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone}
          onBlur={(e) => void call("/api/account/notifications", "PUT", { timezone: e.target.value, locale }, t("notify.saved"))}
          className="max-w-xs"
        />
      </div>

      {message && <p role={message.ok ? "status" : "alert"} className={`text-sm ${message.ok ? "text-success-text" : "text-destructive"}`}>{message.text}</p>}
    </div>
  );
}
