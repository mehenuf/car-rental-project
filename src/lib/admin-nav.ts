import type { LucideIcon } from "lucide-react";
import {
  ArrowLeftRight,
  Barcode,
  FileSignature,
  FileText,
  LayoutDashboard,
  LayoutGrid,
  Layers,
  ListTree,
  Package,
  PackagePlus,
  PackageX,
  Percent,
  QrCode,
  Receipt,
  Ruler,
  ShieldCheck,
  ShieldUser,
  SlidersHorizontal,
  Store,
  Tag,
  Ticket,
  TrendingDown,
  Undo2,
} from "lucide-react";

export interface AdminNavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

export interface AdminNavGroup {
  label: string;
  items: AdminNavItem[];
}

/**
 * Sidebar structure per the dashboard reference image. Only Dashboard
 * (/admin), Products (/admin/vehicles) and Sales (/admin/bookings) are
 * wired to real pages so far — the rest reflect the reference image's
 * menu but resolve to placeholder routes until those screens are built.
 */
export const ADMIN_NAV: AdminNavGroup[] = [
  {
    label: "Main",
    items: [
      { label: "Dashboard", href: "/admin", icon: LayoutDashboard },
      { label: "Super Admin", href: "/admin/super-admin", icon: ShieldUser },
    ],
  },
  {
    label: "Inventory",
    items: [
      { label: "Products", href: "/admin/vehicles", icon: Package },
      { label: "Create Product", href: "/admin/vehicles/new", icon: PackagePlus },
      { label: "Expired Products", href: "/admin/inventory/expired-products", icon: PackageX },
      { label: "Low Stocks", href: "/admin/inventory/low-stocks", icon: TrendingDown },
      { label: "Category", href: "/admin/inventory/category", icon: LayoutGrid },
      { label: "Sub Category", href: "/admin/inventory/sub-category", icon: ListTree },
      { label: "Brands", href: "/admin/inventory/brands", icon: Tag },
      { label: "Units", href: "/admin/inventory/units", icon: Ruler },
      {
        label: "Variant Attributes",
        href: "/admin/inventory/variant-attributes",
        icon: SlidersHorizontal,
      },
      { label: "Warranties", href: "/admin/inventory/warranties", icon: ShieldCheck },
      { label: "Print Barcode", href: "/admin/inventory/print-barcode", icon: Barcode },
      { label: "Print QR Code", href: "/admin/inventory/print-qr-code", icon: QrCode },
    ],
  },
  {
    label: "Stock",
    items: [
      { label: "Manage Stock", href: "/admin/stock/manage", icon: Layers },
      {
        label: "Stock Adjustment",
        href: "/admin/stock/adjustment",
        icon: SlidersHorizontal,
      },
      { label: "Stock Transfer", href: "/admin/stock/transfer", icon: ArrowLeftRight },
    ],
  },
  {
    label: "Sales",
    items: [
      { label: "Sales", href: "/admin/bookings", icon: Receipt },
      { label: "Invoices", href: "/admin/sales/invoices", icon: FileText },
      { label: "Sales Return", href: "/admin/sales/returns", icon: Undo2 },
      { label: "Quotation", href: "/admin/sales/quotation", icon: FileSignature },
      { label: "POS", href: "/admin/sales/pos", icon: Store },
    ],
  },
  {
    label: "Promo",
    items: [
      { label: "Coupons", href: "/admin/promo/coupons", icon: Ticket },
      { label: "Discount Plans", href: "/admin/promo/discount-plans", icon: Percent },
    ],
  },
];
