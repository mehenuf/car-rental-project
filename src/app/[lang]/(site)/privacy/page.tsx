import { getLocale, getT } from "@/lib/i18n/dictionary";
export async function generateMetadata() {
  const t = await getT();
  return { title: t("meta.privacy") };
}

export default async function PrivacyPage() {
  const locale = await getLocale();
  const t = await getT();
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-(--space-md) px-(--space-sm) py-(--space-2xl)">
      <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground">
        Privacy Policy
      </h1>
      {locale !== "en" && <p role="note" className="rounded-lg border border-border bg-muted p-3 text-sm text-foreground">{t("legal.englishOnly")}</p>}
      <p className="text-sm text-muted-foreground">Last updated September 2026.</p>

      <Section title="What we collect">
        When you book a car, we collect your name, email, and phone number to confirm the
        booking and contact you about it. If you book without an account, we store a random
        identifier in a cookie in your browser so you can view your own booking history without
        signing in.
      </Section>

      <Section title="How we use it">
        Booking details are used only to fulfil your rental and to show you your own booking
        history. We do not sell your information to third parties.
      </Section>

      <Section title="Cookies">
        We use one functional cookie to remember guest bookings made in your browser, and a
        session cookie if you create an account. Neither is used for advertising.
      </Section>

      <Section title="Your choices">
        You can clear your browser&apos;s cookies at any time, which will disconnect your browser
        from any guest booking history. If you have an account, you can request deletion of
        your data by contacting us.
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
