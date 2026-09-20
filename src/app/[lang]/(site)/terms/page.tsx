export const metadata = { title: "Terms & Conditions" };

export default function TermsPage() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-(--space-md) px-(--space-sm) py-(--space-2xl)">
      <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground">
        Terms &amp; Conditions
      </h1>
      <p className="text-sm text-muted-foreground">Last updated September 2026.</p>

      <Section title="Bookings">
        A booking is not confirmed until you receive a confirmation email. Prices shown at
        checkout are final; no additional fees are added afterward.
      </Section>

      <Section title="Cancellations">
        You may cancel a pending booking by contacting us with your booking reference. Confirmed
        bookings are subject to the cancellation window stated in your confirmation email.
      </Section>

      <Section title="Vehicle use">
        Renters must hold a valid driving license and meet the minimum age requirement for the
        vehicle category booked. Vehicles must be returned in the condition they were collected
        in, with a full tank of fuel unless otherwise agreed.
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
