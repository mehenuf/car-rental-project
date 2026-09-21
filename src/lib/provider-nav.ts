import { CalendarDays, Car, LayoutDashboard, MessageSquareWarning, Receipt, Settings, Star, Tag, Users, Wallet } from "lucide-react";
import type { AdminNavGroup } from "@/lib/admin-nav";
import type { ProviderRole } from "@/lib/provider/permissions";
import type { TFunction } from "@/lib/i18n/t";
import type { ProviderType } from "@/types/database";

/**
 * The portal menu for a provider type and role. Companies and private owners
 * share the same pages; private owners see friendlier names. Agents only run
 * bookings, so they get a short menu. Only routes that exist are listed.
 */
export function providerNav(type: ProviderType, role: ProviderRole, t: TFunction): AdminNavGroup[] {
  const individual = type === "individual";

  if (role === "agent") {
    return [
      {
        label: t("portal.nav.work"),
        items: [
          { label: t("portal.nav.overview"), href: "/provider", icon: LayoutDashboard },
          { label: t("portal.nav.bookings"), href: "/provider/bookings", icon: Receipt },
        ],
      },
    ];
  }

  const manage = [
    { label: individual ? t("portal.nav.myCars") : t("portal.nav.fleet"), href: "/provider/fleet", icon: Car },
    { label: individual ? t("portal.nav.availability") : t("portal.nav.calendar"), href: "/provider/calendar", icon: CalendarDays },
    { label: individual ? t("portal.nav.requests") : t("portal.nav.bookings"), href: "/provider/bookings", icon: Receipt },
    { label: t("portal.nav.pricing"), href: "/provider/pricing", icon: Tag },
    { label: t("portal.nav.reviews"), href: "/provider/reviews", icon: Star },
    { label: t("portal.nav.disputes"), href: "/provider/disputes", icon: MessageSquareWarning },
  ];

  const account = [
    { label: individual ? t("portal.nav.earnings") : t("portal.nav.payouts"), href: "/provider/payouts", icon: Wallet },
    ...(role === "owner" ? [{ label: t("portal.nav.team"), href: "/provider/team", icon: Users }] : []),
    { label: t("portal.nav.settings"), href: "/provider/settings", icon: Settings },
  ];

  return [
    {
      label: individual ? t("portal.nav.myRentals") : t("portal.nav.overview"),
      items: [{ label: individual ? t("portal.nav.dashboard") : t("portal.nav.overview"), href: "/provider", icon: LayoutDashboard }],
    },
    { label: t("portal.nav.manage"), items: manage },
    { label: t("portal.nav.account"), items: account },
  ];
}
