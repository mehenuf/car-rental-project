"use client";

import { useRef, useState, type FormEvent } from "react";
import { useLocaleRouter, useT } from "@/lib/i18n/provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase";

type Kind = "licence_front" | "licence_back" | "selfie";

interface Props {
  status: "unverified" | "pending" | "verified" | "rejected" | "expired";
  reviewNote: string | null;
  uploaded: Kind[];
  defaults: { date_of_birth: string; licence_country: string; licence_number_last4: string; licence_expiry: string };
}

/** Licence details plus photo uploads (straight to private storage) and submission for review. */
export function DriverForm({ status, reviewNote, uploaded, defaults }: Props) {
  const t = useT();
  const router = useLocaleRouter();
  const [values, setValues] = useState(defaults);
  const [have, setHave] = useState<Set<Kind>>(new Set(uploaded));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const editable = status !== "pending" && status !== "verified";

  async function upload(kind: Kind, file: File) {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/account/driver/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, file_name: file.name, mime_type: file.type, size_bytes: file.size }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error?.message ?? t("driver.uploadFailed"));
      const { error } = await supabase.storage.from(body.bucket).uploadToSignedUrl(body.path, body.token, file);
      if (error) throw new Error(error.message);
      setHave((current) => new Set(current).add(kind));
    } catch (err) {
      setMessage({ text: err instanceof Error ? err.message : t("driver.uploadFailed"), ok: false });
    } finally {
      setBusy(false);
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/account/driver", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error?.message ?? t("auth.genericError"));
      setMessage({ text: t("driver.submitted"), ok: true });
      router.refresh();
    } catch (err) {
      setMessage({ text: err instanceof Error ? err.message : t("auth.genericError"), ok: false });
    } finally {
      setBusy(false);
    }
  }

  const set = (key: keyof typeof values) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setValues((v) => ({ ...v, [key]: e.target.value }));

  return (
    <form onSubmit={submit} className="flex flex-col gap-(--space-sm)">
      {status === "pending" && <p className="text-sm text-muted-foreground">{t("driver.pendingNote")}</p>}
      {status === "verified" && <p className="text-sm text-success-text">{t("driver.verifiedNote")}</p>}
      {status === "rejected" && reviewNote && <p className="text-sm text-destructive">{t("driver.rejectedNote", { note: reviewNote })}</p>}

      <div className="grid gap-(--space-sm) sm:grid-cols-2">
        <Field id="dl-dob" label={t("driver.dob")}><Input id="dl-dob" type="date" value={values.date_of_birth} onChange={set("date_of_birth")} disabled={!editable} required /></Field>
        <Field id="dl-country" label={t("driver.country")}><Input id="dl-country" maxLength={2} value={values.licence_country} onChange={set("licence_country")} disabled={!editable} required /></Field>
        <Field id="dl-last4" label={t("driver.last4")}><Input id="dl-last4" maxLength={4} value={values.licence_number_last4} onChange={set("licence_number_last4")} disabled={!editable} required /></Field>
        <Field id="dl-expiry" label={t("driver.expiry")}><Input id="dl-expiry" type="date" value={values.licence_expiry} onChange={set("licence_expiry")} disabled={!editable} required /></Field>
      </div>

      {editable && (
        <div className="grid gap-(--space-sm) sm:grid-cols-3">
          <FileField kind="licence_front" label={t("driver.front")} done={have.has("licence_front")} doneLabel={t("driver.uploaded")} busy={busy} onPick={upload} />
          <FileField kind="licence_back" label={t("driver.back")} done={have.has("licence_back")} doneLabel={t("driver.uploaded")} busy={busy} onPick={upload} />
          <FileField kind="selfie" label={t("driver.selfie")} done={have.has("selfie")} doneLabel={t("driver.uploaded")} busy={busy} onPick={upload} />
        </div>
      )}

      {message && <p role={message.ok ? "status" : "alert"} className={`text-sm ${message.ok ? "text-success-text" : "text-destructive"}`}>{message.text}</p>}

      {editable && (
        <Button type="submit" className="w-fit" disabled={busy}>
          {busy ? t("driver.submitting") : t("driver.submit")}
        </Button>
      )}
    </form>
  );
}

function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}

function FileField({ kind, label, done, doneLabel, busy, onPick }: { kind: Kind; label: string; done: boolean; doneLabel: string; busy: boolean; onPick: (kind: Kind, file: File) => void }) {
  const input = useRef<HTMLInputElement | null>(null);
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-foreground">{label}</span>
      <input
        ref={input}
        type="file"
        accept={kind === "selfie" ? "image/jpeg,image/png,image/webp" : "image/jpeg,image/png,image/webp,application/pdf"}
        className="sr-only"
        aria-label={label}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onPick(kind, file);
          e.target.value = "";
        }}
      />
      <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => input.current?.click()}>
        {done ? `${doneLabel} ✓` : label}
      </Button>
    </div>
  );
}
