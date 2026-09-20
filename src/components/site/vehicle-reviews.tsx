import { StarsDisplay } from "@/components/site/star-rating";
import { getLocale, getT } from "@/lib/i18n/dictionary";
import { formatDateLocale } from "@/lib/i18n/format";
import { supabaseAdmin } from "@/lib/supabase-server";

/** Published reviews of a vehicle, with the rental company's reply when there is one. */
export async function VehicleReviews({ vehicleId }: { vehicleId: string }) {
  const t = await getT();
  const locale = await getLocale();

  const { data: reviews } = await supabaseAdmin
    .from("reviews")
    .select("id, overall, comment, published_at")
    .eq("vehicle_id", vehicleId)
    .eq("direction", "customer_to_provider")
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(20);
  if (!reviews || reviews.length === 0) return null;

  const { data: replies } = await supabaseAdmin.from("review_replies").select("review_id, body").in("review_id", reviews.map((r) => r.id));

  return (
    <section className="flex flex-col gap-(--space-xs)" aria-labelledby="reviews-title">
      <h2 id="reviews-title" className="font-heading text-lg font-semibold text-foreground">{t("reviews.title")}</h2>
      <ul className="flex flex-col gap-(--space-xs)">
        {reviews.map((r) => {
          const reply = (replies ?? []).find((x) => x.review_id === r.id);
          return (
            <li key={r.id} className="flex flex-col gap-1 border-b border-border pb-(--space-xs) last:border-0">
              <div className="flex items-center gap-2">
                <StarsDisplay value={r.overall} label={t("reviews.stars", { n: r.overall })} />
                {r.published_at && <span className="text-xs text-muted-foreground">{formatDateLocale(r.published_at, locale)}</span>}
              </div>
              {r.comment && <p className="whitespace-pre-wrap break-words text-sm text-foreground">{r.comment}</p>}
              {reply && (
                <p className="ms-4 border-s-2 border-border ps-3 text-sm text-muted-foreground">
                  <span className="font-medium">{t("reviews.reply")}: </span>
                  {reply.body}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
