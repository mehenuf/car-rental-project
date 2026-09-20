"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { StarPicker } from "@/components/site/star-rating";
import { CUSTOMER_ASPECTS } from "@/lib/reviews/rules";
import { useLocaleRouter, useT } from "@/lib/i18n/provider";

interface Existing {
  id: string;
  overall: number;
  aspects: Record<string, number>;
  comment: string | null;
  editable: boolean;
}

/** A renter's review of the rental company: overall, four aspects and an optional comment. */
export function ReviewForm({ bookingId, existing }: { bookingId: string; existing: Existing | null }) {
  const t = useT();
  const router = useLocaleRouter();
  const [overall, setOverall] = useState(existing?.overall ?? 0);
  const [aspects, setAspects] = useState<Record<string, number>>(existing?.aspects ?? {});
  const [comment, setComment] = useState(existing?.comment ?? "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  const locked = existing !== null && !existing.editable;
  const stars = (n: number) => t("reviews.stars", { n });

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (overall < 1) return setMessage({ text: t("reviews.pickOverall"), ok: false });
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/account/reviews", {
        method: existing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ booking_id: bookingId, review_id: existing?.id, overall, aspects, comment: comment || undefined }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error?.message ?? t("reviews.error"));
      setMessage({ text: t("reviews.thanks"), ok: true });
      router.refresh();
    } catch (err) {
      setMessage({ text: err instanceof Error ? err.message : t("reviews.error"), ok: false });
    } finally {
      setBusy(false);
    }
  }

  if (locked) return <p className="text-sm text-muted-foreground">{t("reviews.submitted")}</p>;

  return (
    <form onSubmit={submit} className="flex flex-col gap-(--space-sm)">
      <div className="flex flex-col gap-1.5">
        <Label>{t("reviews.overall")}</Label>
        <StarPicker label={t("reviews.overall")} value={overall} onChange={setOverall} valueLabel={stars} />
      </div>
      <div className="grid gap-(--space-xs) sm:grid-cols-2">
        {CUSTOMER_ASPECTS.map((key) => (
          <div key={key} className="flex flex-col gap-1">
            <Label>{t(`reviews.${key}`)}</Label>
            <StarPicker label={t(`reviews.${key}`)} value={aspects[key] ?? 0} onChange={(v) => setAspects((a) => ({ ...a, [key]: v }))} valueLabel={stars} />
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="rv-comment">{t("reviews.comment")}</Label>
        <Textarea id="rv-comment" rows={3} maxLength={2000} value={comment} onChange={(e) => setComment(e.target.value)} />
      </div>
      {message && <p role={message.ok ? "status" : "alert"} className={`text-sm ${message.ok ? "text-success-text" : "text-destructive"}`}>{message.text}</p>}
      <Button type="submit" className="w-fit" disabled={busy}>{busy ? t("reviews.submitting") : t("reviews.submit")}</Button>
    </form>
  );
}
