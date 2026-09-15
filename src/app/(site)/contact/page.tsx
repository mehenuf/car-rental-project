import { Mail, MessageCircle, Phone } from "lucide-react";

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
      <div className="flex flex-col gap-(--space-2xs) text-center">
        <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Get in touch
        </h1>
        <p className="mx-auto max-w-xl text-muted-foreground">
          Questions about a booking, a vehicle, or your account? Reach us through any of the
          channels below.
        </p>
      </div>

      <div className="flex flex-col divide-y divide-border border-t border-border">
        {CHANNELS.map(({ icon: Icon, title, body }) => (
          <div key={title} className="flex items-center gap-4 py-(--space-md)">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent-text">
              <Icon className="size-5" aria-hidden />
            </div>
            <div className="flex flex-col gap-0.5">
              <h2 className="font-heading text-sm font-semibold text-foreground">{title}</h2>
              <p className="text-sm text-muted-foreground">{body}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
