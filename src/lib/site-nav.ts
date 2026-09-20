export interface SiteNavLink {
  /** Key under `nav` in the message catalogue. */
  labelKey: "home" | "cars" | "howItWorks" | "about" | "contact";
  href: string;
}

export const SITE_NAV_LINKS: SiteNavLink[] = [
  { labelKey: "home", href: "/" },
  { labelKey: "cars", href: "/cars" },
  { labelKey: "howItWorks", href: "/#how-it-works" },
  { labelKey: "about", href: "/about" },
  { labelKey: "contact", href: "/contact" },
];
