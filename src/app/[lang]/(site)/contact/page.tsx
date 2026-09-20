import { pageMetadata } from "@/lib/seo/metadata";
import { Mail, MessageCircle, Phone } from "lucide-react";
import { ScrollReveal } from "@/components/site/scroll-reveal";
import { LiveChatTrigger } from "@/components/site/live-chat-trigger";
import { getT } from "@/lib/i18n/dictionary";

export const generateMetadata = () => pageMetadata("/contact", { title: "Contact Us" });

export default async function ContactPage() {
  const t = await getT();
  const CHANNELS = [
    { icon: MessageCircle, title: t("contact.chatTitle"), body: t("contact.chatBody"), isLiveChat: true },
    { icon: Mail, title: t("contact.emailTitle"), body: "support@bestcar.example", isLiveChat: false },
    { icon: Phone, title: t("contact.phoneTitle"), body: t("contact.phoneBody"), isLiveChat: false },
  ];
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-(--space-lg) px-(--space-sm) py-(--space-2xl)">
      <ScrollReveal className="flex flex-col gap-(--space-2xs) text-center">
        <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          {t("contact.title")}
        </h1>
        <p className="mx-auto max-w-xl text-muted-foreground">
          {t("contact.intro")}
        </p>
      </ScrollReveal>

      <div className="flex flex-col divide-y divide-border border-t border-border">
        {CHANNELS.map(({ icon: Icon, title, body, isLiveChat }, index) => {
          const content = (
            <>
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent-text">
                <Icon className="size-5" aria-hidden />
              </div>
              <div className="flex flex-col gap-0.5">
                <h2 className="font-heading text-sm font-semibold text-foreground">{title}</h2>
                <p className="text-sm text-muted-foreground">{body}</p>
              </div>
            </>
          );

          return (
            <ScrollReveal key={title} delay={index * 0.1}>
              {isLiveChat ? (
                <LiveChatTrigger>{content}</LiveChatTrigger>
              ) : (
                <div className="flex items-center gap-4 py-(--space-md)">{content}</div>
              )}
            </ScrollReveal>
          );
        })}
      </div>
    </div>
  );
}
