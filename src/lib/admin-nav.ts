import type { LucideIcon } from "lucide-react";
import { BarChart3, Building2, CheckCheck, IdCard, LayoutDashboard, Package, Receipt, ScrollText, Settings, ShieldAlert, ShieldCheck, Users } from "lucide-react";

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
      { label: "Providers", href: "/admin/providers", icon: Building2 },
      { label: "Licences", href: "/admin/licences", icon: IdCard },
      { label: "Trust and safety", href: "/admin/trust", icon: ShieldAlert },
    ],
  },
  {
    label: "Finance and control",
    items: [
      { label: "Reports", href: "/admin/reports", icon: BarChart3 },
      { label: "Approvals", href: "/admin/approvals", icon: CheckCheck },
      { label: "Audit log", href: "/admin/audit", icon: ScrollText },
      { label: "Staff", href: "/admin/staff", icon: ShieldCheck },
      { label: "Settings", href: "/admin/settings", icon: Settings },
    ],
  },
];
