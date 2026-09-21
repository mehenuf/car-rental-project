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
        Your name, email and phone number when you book or create an account; your bookings and
        payment records; and, if you choose to add them, your driver profile and licence
        documents, messages with hosts, reviews and notification preferences. If you book without
        an account, we store a random identifier in a cookie in your browser so you can see your
        own bookings. Text you type into the chat assistant is processed to answer you.
      </Section>

      <Section title="How we use it">
        To run your rental, show you your bookings, check that a renter may drive, prevent fraud,
        and send the notifications you allow. The host of a car you book sees the details they
        need to hand over the car, such as your name, contact details and trip times. We do not
        sell your information.
      </Section>

      <Section title="Who else handles it">
        Service providers that run the site for us: hosting and database, payment processing,
        email and text message delivery when those are switched on, and the provider behind the
        chat assistant. Please do not type personal details into the chat.
      </Section>

      <Section title="Cookies">
        Necessary cookies keep you signed in, remember guest bookings made in your browser, and
        store your language, place, theme and cookie choice. Analytics cookies are used only if
        you allow them in the banner, and you can change that at any time under Privacy in your
        account. Nothing is used for advertising.
      </Section>

      <Section title="Your choices">
        Sign in and open Account, then Privacy, to download a copy of your data, change your
        cookie choice, or delete your account. Deleting removes your personal data and anonymises
        your bookings; payment and booking records we must keep by law stay, without your name,
        email or phone. You cannot delete while a booking is open or a dispute is unresolved.
        You can also clear your browser&apos;s cookies at any time.
      </Section>

      <Section title="How long we keep it">
        Account and booking data is kept while your account exists. Delivery logs for
        notifications are removed after a set number of days. Records we must keep for accounting
        are kept without personal details after you delete your account.
      </Section>

      <Section title="Questions">
        BestCar has no support inbox yet. For a question about your data, use the chat on any
        page or the Privacy page in your account.
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
