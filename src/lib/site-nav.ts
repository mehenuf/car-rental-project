export interface SiteNavLink {
  label: string;
  href: string;
}

export const SITE_NAV_LINKS: SiteNavLink[] = [
  { label: "Home", href: "/" },
  { label: "How It Works", href: "/#how-it-works" },
  { label: "Rental Deals", href: "/#rental-deals" },
  { label: "Why Choose Us", href: "/#why-choose-us" },
  { label: "Testimonial", href: "/#testimonials" },
];
