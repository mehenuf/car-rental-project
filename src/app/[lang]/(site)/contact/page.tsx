import { pageMetadata } from "@/lib/seo/metadata";
import { ChevronRight, MessageCircle, Store, TicketCheck } from "lucide-react";
import { Link } from "@/lib/i18n/link";
import { ScrollReveal } from "@/components/site/scroll-reveal";
import { LiveChatTrigger } from "@/components/site/live-chat-trigger";
import { getT } from "@/lib/i18n/dictionary";

export async function generateMetadata() {
  const t = await getT();
  return pageMetadata("/contact", { title: t("meta.contact") });
}

const ROW = "flex w-full items-center gap-4 py-(--space-md) text-start transition-colors hover:bg-muted/50 focus-visible:bg-muted/50";

/**
 * There is no support mailbox or phone line, so the page says so and points to the three places a question is
 * actually answered: the assistant, the booking's own messages and dispute button, and the host portal.
 */
export default async function ContactPage() {
  const t = await getT();
  const rows = [
    { icon: MessageCircle, title: t("contact.chatTitle"), body: t("contact.chatBody"), kind: "chat" as const },
    { icon: TicketCheck, title: t("contact.bookingTitle"), body: t("contact.bookingBody"), kind: "link" as const, href: "/account" },
    { icon: Store, title: t("contact.hostTitle"), body: t("contact.hostBody"), kind: "link" as const, href: "/provider" },
  ];

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-(--space-lg) px-(--space-sm) py-(--space-2xl)">
      <ScrollReveal className="flex flex-col gap-(--space-2xs)">
        <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground sm:text-4xl">{t("contact.title")}</h1>
        <p className="max-w-xl text-muted-foreground">{t("contact.intro")}</p>
      </ScrollReveal>

      <ul className="flex flex-col divide-y divide-border border-y border-border">
        {rows.map((row) => {
          const content = (
            <>
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent-text">
                <row.icon className="size-5" aria-hidden="true" />
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="font-heading text-sm font-semibold text-foreground">{row.title}</span>
                <span className="text-sm text-muted-foreground">{row.body}</span>
              </span>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground rtl:rotate-180" aria-hidden="true" />
            </>
          );
          return (
            <li key={row.title}>
              {row.kind === "chat" ? (
                <LiveChatTrigger>{content}</LiveChatTrigger>
              ) : (
                <Link href={row.href} className={ROW}>
                  {content}
                </Link>
              )}
            </li>
          );
        })}
      </ul>

      <p className="text-sm text-muted-foreground">{t("contact.note")}</p>
    </div>
  );
}
