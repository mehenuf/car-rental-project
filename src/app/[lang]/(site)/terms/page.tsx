import { getLocale, getT } from "@/lib/i18n/dictionary";
export async function generateMetadata() {
  const t = await getT();
  return { title: t("meta.terms") };
}

export default async function TermsPage() {
  const locale = await getLocale();
  const t = await getT();
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-(--space-md) px-(--space-sm) py-(--space-2xl)">
      <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground">
        Terms &amp; Conditions
      </h1>
      {locale !== "en" && <p role="note" className="rounded-lg border border-border bg-muted p-3 text-sm text-foreground">{t("legal.englishOnly")}</p>}
      <p className="text-sm text-muted-foreground">Last updated September 2026.</p>

      <Section title="What BestCar is">
        BestCar is a marketplace. The cars are offered by independent local rental companies and
        private owners (&ldquo;hosts&rdquo;). Your rental is with the host of the car; BestCar
        provides the site, takes your payment and pays the host after the trip.
      </Section>

      <Section title="This is a demonstration">
        Payments and payouts in this version of BestCar are simulated. No real card is charged
        and no real money moves. Do not enter real card details.
      </Section>

      <Section title="Bookings">
        Choosing your dates and pressing Book now holds the car for 15 minutes while you pay. The
        booking is confirmed when payment succeeds; you will see it on the confirmation page and
        under My bookings. The price shown at checkout is the price you pay, with fees included.
        An unpaid hold that runs out is released and the car becomes available again.
      </Section>

      <Section title="Cancellations and refunds">
        You can cancel from My bookings while your booking is pending or confirmed. How much is
        refunded depends on how long before pick-up you cancel, following the cancellation terms
        frozen into your booking when you made it. There is no automatic refund once pick-up has
        passed. If the host or BestCar cancels, you are refunded in full.
      </Section>

      <Section title="Deposits">
        Some cars need a security deposit. It is held on your payment method, not spent, and
        released after the car is returned. It can be taken, in whole or in part, for damage or
        charges that the trip record supports.
      </Section>

      <Section title="Driving and using the car">
        Renters must hold a valid driving licence and meet the minimum age for the car. Some
        hosts ask you to add your licence details to your account before pick-up. Return the car
        in the condition you collected it, with the fuel level agreed with the host.
      </Section>

      <Section title="Reviews and disputes">
        Reviews come from completed trips. If something goes wrong on a trip, you can raise a
        dispute from the booking page and our team will look at it.
      </Section>

      <Section title="Liability">
        BestCar is not liable for indirect losses arising from a delayed or cancelled booking.
        Our liability for a confirmed booking is limited to the amount paid for that booking.
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-(--space-2xs)">
      <h2 className="font-heading text-lg font-semibold text-foreground">{title}</h2>
      <p className="text-sm leading-relaxed text-muted-foreground">{children}</p>
    </div>
  );
}
