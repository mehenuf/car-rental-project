import Link from "next/link";
import { Car } from "lucide-react";

const FOOTER_COLUMNS: { title: string; links: { label: string; href: string }[] }[] = [
  {
    title: "About",
    links: [
      { label: "How it works", href: "/#how-it-works" },
      { label: "Featured", href: "/#rental-deals" },
      { label: "Partnership", href: "#" },
    ],
  },
  {
    title: "Community",
    links: [
      { label: "Events", href: "#" },
      { label: "Blog", href: "#" },
      { label: "Podcast", href: "#" },
    ],
  },
  {
    title: "Socials",
    links: [
      { label: "Discord", href: "#" },
      { label: "Instagram", href: "#" },
      { label: "Twitter", href: "#" },
    ],
  },
];

function FacebookIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M13.5 21v-7.5h2.5l.5-3h-3V8.5c0-.9.25-1.5 1.55-1.5H16.5V4.3c-.28-.04-1.24-.12-2.35-.12-2.33 0-3.93 1.42-3.93 4.03V10.5H8v3h2.22V21h3.28Z" />
    </svg>
  );
}

function TwitterIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M20.9 7.14c.01.18.01.35.01.53 0 5.4-4.1 11.62-11.62 11.62-2.31 0-4.46-.67-6.27-1.84.32.04.63.05.96.05 1.92 0 3.68-.65 5.09-1.75a4.1 4.1 0 0 1-3.82-2.84c.25.04.5.07.77.07.37 0 .74-.05 1.08-.14a4.09 4.09 0 0 1-3.28-4.02v-.05c.55.3 1.18.49 1.85.51a4.08 4.08 0 0 1-1.82-3.4c0-.76.2-1.45.56-2.06a11.63 11.63 0 0 0 8.44 4.28 4.6 4.6 0 0 1-.1-.94 4.08 4.08 0 0 1 7.06-2.79 8.03 8.03 0 0 0 2.59-.99 4.07 4.07 0 0 1-1.8 2.26 8.17 8.17 0 0 0 2.34-.64 8.36 8.36 0 0 1-2.04 2.14Z" />
    </svg>
  );
}

function InstagramIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} {...props}>
      <rect x="3.5" y="3.5" width="17" height="17" rx="4.5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.2" cy="6.8" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-card">
      <div className="mx-auto flex max-w-7xl flex-col gap-(--space-lg) px-(--space-sm) py-(--space-lg)">
        <div className="grid grid-cols-1 gap-(--space-md) sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1fr]">
          <div className="flex flex-col gap-(--space-xs)">
            <Link href="/" className="flex items-center gap-2 font-heading text-lg font-bold text-foreground">
              <Car className="size-6 text-accent" />
              BestCar
            </Link>
            <p className="max-w-xs text-sm text-muted-foreground">
              Our vision is to provide convenience and help increase your rental business&apos;s sales.
            </p>
            <div className="flex items-center gap-2 pt-(--space-2xs)">
              {[FacebookIcon, TwitterIcon, InstagramIcon].map((Icon, i) => (
                <a
                  key={i}
                  href="#"
                  aria-label="Social link"
                  className="flex size-9 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                >
                  <Icon className="size-4" />
                </a>
              ))}
            </div>
          </div>

          {FOOTER_COLUMNS.map((column) => (
            <div key={column.title} className="flex flex-col gap-(--space-xs)">
              <h3 className="font-heading text-sm font-semibold text-foreground">{column.title}</h3>
              <ul className="flex flex-col gap-2">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="flex flex-col items-center justify-between gap-(--space-xs) border-t border-border pt-(--space-sm) text-sm text-muted-foreground sm:flex-row">
          <p>&copy; {new Date().getFullYear()} BestCar. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <Link href="#" className="hover:text-foreground">
              Privacy Policy
            </Link>
            <Link href="#" className="hover:text-foreground">
              Terms &amp; Conditions
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
