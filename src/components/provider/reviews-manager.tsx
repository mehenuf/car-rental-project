"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Status, send, useSave } from "@/components/provider/form-utils";
import { StarPicker, StarsDisplay } from "@/components/site/star-rating";
import { useApiData } from "@/hooks/use-api-data";
import { formatDate } from "@/lib/format";
import { useLocale, useT } from "@/lib/i18n/provider";

interface Data {
  reviews: { id: string; overall: number; comment: string | null; published_at: string; reply: string | null }[];
  toReview: { id: string; reference: string; customer_name: string; completed_at: string }[];
}

function ReviewCustomer({ bookingId, onDone }: { bookingId: string; onDone: () => void }) {
  const t = useT();
  const [overall, setOverall] = useState(0);
  const [care, setCare] = useState(0);
  const [communication, setCommunication] = useState(0);
  const [comment, setComment] = useState("");
  const save = useSave();
  const label = (n: number) => t("portal.reviews.outOfFive", { n });
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
      <StarPicker label={t("portal.reviews.overall")} value={overall} onChange={setOverall} valueLabel={label} />
      <div className="grid gap-2 sm:grid-cols-2">
        <div><Label>{t("portal.reviews.care")}</Label><StarPicker label={t("portal.reviews.care")} value={care} onChange={setCare} valueLabel={label} /></div>
        <div><Label>{t("portal.reviews.communication")}</Label><StarPicker label={t("portal.reviews.communication")} value={communication} onChange={setCommunication} valueLabel={label} /></div>
      </div>
      <Input aria-label={t("portal.reviews.comment")} placeholder={t("portal.reviews.commentPlaceholder")} value={comment} onChange={(e) => setComment(e.target.value)} maxLength={2000} />
      <Status message={save.message} ok={save.ok} />
      <Button
        type="button" size="sm" className="w-fit" disabled={save.busy || overall < 1}
        onClick={() => void save.run(async () => {
          await send("/api/provider/reviews", "POST", {
            booking_id: bookingId, overall,
            aspects: { ...(care ? { care } : {}), ...(communication ? { communication } : {}) },
            comment: comment || undefined,
          });
          onDone();
        }, t("portal.reviews.submitted"))}
      >
        {t("portal.reviews.submit")}
      </Button>
    </div>
  );
}

function Reply({ reviewId, onDone }: { reviewId: string; onDone: () => void }) {
  const t = useT();
  const [body, setBody] = useState("");
  const save = useSave();
  return (
    <div className="flex flex-col gap-1.5">
      <Input aria-label={t("portal.reviews.reply")} placeholder={t("portal.reviews.replyPlaceholder")} value={body} onChange={(e) => setBody(e.target.value)} maxLength={1000} />
      <Status message={save.message} ok={save.ok} />
      <Button type="button" size="sm" variant="outline" className="w-fit" disabled={save.busy || !body.trim()} onClick={() => void save.run(async () => { await send(`/api/provider/reviews/${reviewId}/reply`, "POST", { body }); onDone(); }, t("portal.reviews.replyPosted"))}>{t("portal.reviews.reply")}</Button>
    </div>
  );
}

export function ReviewsManager() {
  const t = useT();
  const locale = useLocale();
  const [refresh, setRefresh] = useState(0);
  const result = useApiData<Data>(`/api/provider/reviews?_r=${refresh}`);
  const changed = () => setRefresh((n) => n + 1);
  const data = result.status === "success" ? result.data : null;

  return (
    <div className="flex flex-col gap-(--space-md)">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-bold text-foreground">{t("portal.nav.reviews")}</h1>
        <p className="text-sm text-muted-foreground">{t("portal.reviews.intro")}</p>
      </div>
      {result.status === "loading" && <p className="text-sm text-muted-foreground">{t("portal.common.loading")}</p>}
      {result.status === "error" && <p className="text-sm text-destructive">{result.error}</p>}

      {data && data.toReview.length > 0 && (
        <Card className="shadow-card ring-0">
          <CardContent className="flex flex-col gap-(--space-xs)">
            <h2 className="font-heading text-base font-semibold text-foreground">{t("portal.reviews.reviewRenters")}</h2>
            {data.toReview.map((b) => (
              <div key={b.id} className="flex flex-col gap-1">
                <p className="text-sm text-foreground">{t("portal.reviews.returned", { reference: b.reference, customer: b.customer_name, date: formatDate(b.completed_at, locale) })}</p>
                <ReviewCustomer bookingId={b.id} onDone={changed} />
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {data && data.reviews.length === 0 && <p className="text-sm text-muted-foreground">{t("portal.reviews.none")}</p>}
      {data?.reviews.map((r) => (
        <Card key={r.id} className="shadow-card ring-0">
          <CardContent className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2"><StarsDisplay value={r.overall} label={t("portal.reviews.outOfFive", { n: r.overall })} /><span className="text-xs text-muted-foreground">{formatDate(r.published_at, locale)}</span></div>
            {r.comment && <p className="whitespace-pre-wrap text-sm text-foreground">{r.comment}</p>}
            {r.reply ? <p className="border-s-2 border-border ps-3 text-sm text-muted-foreground">{t("portal.reviews.yourReply", { reply: r.reply })}</p> : <Reply reviewId={r.id} onDone={changed} />}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
