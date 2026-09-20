import { CalendarDays, Car, LayoutDashboard, Receipt, Settings, Tag, Users, Wallet } from "lucide-react";
import type { AdminNavGroup } from "@/lib/admin-nav";
import type { ProviderRole } from "@/lib/provider/permissions";
import type { ProviderType } from "@/types/database";

/**
 * The portal menu for a provider type and role. Companies and private owners
 * share the same pages; private owners see friendlier names. Agents only run
 * bookings, so they get a short menu. Only routes that exist are listed.
 */
export function providerNav(type: ProviderType, role: ProviderRole): AdminNavGroup[] {
  const individual = type === "individual";

  if (role === "agent") {
    return [
      {
        label: "Work",
        items: [
          { label: "Overview", href: "/provider", icon: LayoutDashboard },
          { label: "Bookings", href: "/provider/bookings", icon: Receipt },
        ],
      },
    ];
  }

  const manage = [
    { label: individual ? "My cars" : "Fleet", href: "/provider/fleet", icon: Car },
    { label: individual ? "Availability" : "Calendar", href: "/provider/calendar", icon: CalendarDays },
    { label: individual ? "Requests" : "Bookings", href: "/provider/bookings", icon: Receipt },
    { label: "Pricing", href: "/provider/pricing", icon: Tag },
  ];

  const account = [
    { label: individual ? "Earnings" : "Payouts", href: "/provider/payouts", icon: Wallet },
    ...(role === "owner" ? [{ label: "Team", href: "/provider/team", icon: Users }] : []),
    { label: "Settings", href: "/provider/settings", icon: Settings },
  ];

  return [
    {
      label: individual ? "My rentals" : "Overview",
      items: [{ label: individual ? "Dashboard" : "Overview", href: "/provider", icon: LayoutDashboard }],
    },
    { label: "Manage", items: manage },
    { label: "Account", items: account },
  ];
}
