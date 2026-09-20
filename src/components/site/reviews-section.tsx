import { Star } from "lucide-react";
import { ScrollReveal } from "@/components/site/scroll-reveal";
import { getT } from "@/lib/i18n/dictionary";
import type { FeaturedReview } from "@/lib/home-data";

function Stars({ value, label }: { value: number; label: string }) {
  return (
    <span className="flex gap-0.5 text-accent-text" role="img" aria-label={label}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} aria-hidden="true" className={i < value ? "size-4 fill-current" : "size-4 opacity-30"} />
      ))}
    </span>
  );
}

/**
 * Real, published reviews from completed trips. If there are none yet the section is not shown at all: a landing
 * page should never invent praise.
 */
export async function ReviewsSection({ reviews }: { reviews: FeaturedReview[] }) {
  if (reviews.length === 0) return null;
  const t = await getT();
  const [lead, ...rest] = reviews;
  if (!lead) return null;

  return (
    <section id="reviews" className="mx-auto max-w-7xl px-(--space-sm) py-(--space-xl)">
      <ScrollReveal className="flex flex-col gap-2">
        <h2 className="font-heading text-3xl font-bold text-foreground">{t("landing.reviews.title")}</h2>
        <p className="max-w-xl text-muted-foreground">{t("landing.reviews.subtitle")}</p>
      </ScrollReveal>

      <div className="mt-(--space-md) grid grid-cols-1 gap-(--space-sm) lg:grid-cols-[1.3fr_1fr]">
        <ScrollReveal className="flex flex-col justify-between gap-(--space-md) rounded-3xl bg-card p-(--space-md) ring-1 ring-border sm:p-(--space-lg)">
          <blockquote className="font-heading text-xl font-medium leading-snug text-foreground sm:text-2xl">
            <p>“{lead.comment}”</p>
          </blockquote>
          <footer className="flex flex-col gap-1">
            <Stars value={lead.overall} label={t("testimonials.rated", { rating: lead.overall })} />
            <span className="text-sm text-muted-foreground">
              {[lead.reviewer, lead.vehicleName].filter(Boolean).join(", ")}
            </span>
          </footer>
        </ScrollReveal>

        <div className="flex flex-col gap-(--space-sm)">
          {rest.map((review, i) => (
            <ScrollReveal
              key={review.id}
              delay={0.08 * (i + 1)}
              className="flex flex-1 flex-col justify-between gap-3 rounded-2xl border border-border p-(--space-sm)"
            >
              <blockquote className="text-sm leading-relaxed text-foreground">
                <p>“{review.comment}”</p>
              </blockquote>
              <footer className="flex flex-col gap-1">
                <Stars value={review.overall} label={t("testimonials.rated", { rating: review.overall })} />
                <span className="text-xs text-muted-foreground">
                  {[review.reviewer, review.vehicleName].filter(Boolean).join(", ")}
                </span>
              </footer>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
