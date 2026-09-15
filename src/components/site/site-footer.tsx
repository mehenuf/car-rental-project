import Link from "next/link";
import { Car } from "lucide-react";

const FOOTER_COLUMNS: { title: string; links: { label: string; href: string }[] }[] = [
  {
    title: "Company",
    links: [
      { label: "How it works", href: "/#how-it-works" },
      { label: "Browse cars", href: "/cars" },
      { label: "About us", href: "/about" },
    ],
  },
  {
    title: "Support",
    links: [
      { label: "Contact us", href: "/contact" },
      { label: "My bookings", href: "/dashboard" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-card">
      <div className="mx-auto flex max-w-7xl flex-col gap-(--space-lg) px-(--space-sm) py-(--space-lg)">
        <div className="grid grid-cols-1 gap-(--space-md) sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr]">
          <div className="flex flex-col gap-(--space-xs)">
            <Link href="/" className="flex items-center gap-2 font-heading text-lg font-bold text-foreground">
              <Car className="size-6 text-accent-text" />
              BestCar
            </Link>
            <p className="max-w-xs text-sm text-muted-foreground">
              Convenient, transparent car rental. Book online in minutes, no account required.
            </p>
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
            <Link href="/privacy" className="hover:text-foreground">
              Privacy Policy
            </Link>
            <Link href="/terms" className="hover:text-foreground">
              Terms &amp; Conditions
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
