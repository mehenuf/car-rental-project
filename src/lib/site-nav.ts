export interface SiteNavLink {
  label: string;
  href: string;
}

export const SITE_NAV_LINKS: SiteNavLink[] = [
  { label: "Home", href: "/" },
  { label: "Cars", href: "/cars" },
  { label: "How It Works", href: "/#how-it-works" },
  { label: "About", href: "/about" },
  { label: "Contact", href: "/contact" },
];
