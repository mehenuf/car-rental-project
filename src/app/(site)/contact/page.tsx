import { Mail, MessageCircle, Phone } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Reveal } from "@/components/site/reveal";

export const metadata = { title: "Contact Us" };

const CHANNELS = [
  {
    icon: MessageCircle,
    title: "Live chat",
    body: "The fastest way to reach us. Open the chat bubble in the corner of any page.",
  },
  {
    icon: Mail,
    title: "Email",
    body: "support@bestcar.example",
  },
  {
    icon: Phone,
    title: "Phone",
    body: "+44 20 7946 0958 (Mon-Fri, 9am-6pm GMT)",
  },
];

export default function ContactPage() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-(--space-lg) px-(--space-sm) py-(--space-2xl)">
      <Reveal className="flex flex-col gap-(--space-2xs) text-center">
        <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Get in touch
        </h1>
        <p className="mx-auto max-w-xl text-muted-foreground">
          Questions about a booking, a vehicle, or your account? Reach us through any of the
          channels below.
        </p>
      </Reveal>

      <div className="grid grid-cols-1 gap-(--space-sm) sm:grid-cols-3">
        {CHANNELS.map(({ icon: Icon, title, body }, i) => (
          <Reveal key={title} delayMs={i * 100}>
            <Card className="shadow-card ring-0">
              <CardContent className="flex flex-col items-center gap-(--space-2xs) text-center">
                <div className="flex size-10 items-center justify-center rounded-full bg-accent/10 text-accent">
                  <Icon className="size-5" aria-hidden />
                </div>
                <h2 className="font-heading text-sm font-semibold text-foreground">{title}</h2>
                <p className="text-sm text-muted-foreground">{body}</p>
              </CardContent>
            </Card>
          </Reveal>
        ))}
      </div>
    </div>
  );
}
