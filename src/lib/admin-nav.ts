import type { LucideIcon } from "lucide-react";
import { LayoutDashboard, Package, Receipt, Users } from "lucide-react";

export interface AdminNavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

export interface AdminNavGroup {
  label: string;
  items: AdminNavItem[];
}

/** Only routes that actually exist — every item here resolves to a real page. */
export const ADMIN_NAV: AdminNavGroup[] = [
  {
    label: "Overview",
    items: [{ label: "Dashboard", href: "/admin", icon: LayoutDashboard }],
  },
  {
    label: "Manage",
    items: [
      { label: "Products", href: "/admin/vehicles", icon: Package },
      { label: "Sales", href: "/admin/bookings", icon: Receipt },
      { label: "Leads", href: "/admin/leads", icon: Users },
    ],
  },
];
