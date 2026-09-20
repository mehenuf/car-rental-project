import type { Permission } from "./permissions";

export interface ExportSpec {
  table: string;
  columns: string[];
  /** The timestamp column the date range filters on. */
  dateColumn: string;
  permission: Permission;
  filter?: { column: string; value: string };
  orderBy: string;
}

/** Streamed CSV exports. Each names only the columns that are safe to hand to staff (no secrets, no payment provider references). */
export const EXPORTS: Record<string, ExportSpec> = {
  bookings: {
    table: "bookings",
    columns: ["reference", "status", "payment_status", "currency", "total_amount", "pickup_at", "dropoff_at", "provider_id", "pickup_branch_id", "source", "created_at"],
    dateColumn: "created_at",
    permission: "bookings.read",
    orderBy: "created_at",
  },
  payments: {
    table: "payments",
    columns: ["id", "booking_id", "kind", "method", "provider", "status", "amount_minor", "currency", "created_at"],
    dateColumn: "created_at",
    permission: "payments.read",
    orderBy: "created_at",
  },
  refunds: {
    table: "payments",
    columns: ["id", "booking_id", "method", "status", "amount_minor", "currency", "provider_part_minor", "platform_part_minor", "created_at"],
    dateColumn: "created_at",
    permission: "payments.read",
    filter: { column: "kind", value: "refund" },
    orderBy: "created_at",
  },
  payouts: {
    table: "payouts",
    columns: ["id", "provider_id", "booking_id", "amount_minor", "currency", "status", "release_after", "paid_at", "created_at"],
    dateColumn: "created_at",
    permission: "payouts.manage",
    orderBy: "created_at",
  },
  ledger: {
    table: "ledger_entries_export",
    columns: ["entry_id", "transaction_id", "created_at", "kind", "account", "direction", "amount_minor", "currency", "booking_id"],
    dateColumn: "created_at",
    permission: "ledger.read",
    orderBy: "entry_id",
  },
  tax: {
    table: "v_tax_collected_by_country",
    columns: ["country_code", "currency", "tax_minor"],
    dateColumn: "",
    permission: "reports.read",
    orderBy: "country_code",
  },
  providers: {
    table: "providers",
    columns: ["id", "type", "display_name", "country_code", "default_currency", "status", "created_at"],
    dateColumn: "created_at",
    permission: "providers.review",
    orderBy: "created_at",
  },
  audit: {
    table: "audit_log",
    columns: ["id", "at", "actor_user_id", "actor_role", "action", "entity_type", "entity_id", "reason", "ip", "request_id"],
    dateColumn: "at",
    permission: "audit.read",
    orderBy: "id",
  },
};

export const MAX_EXPORT_DAYS = 366;

/** Validates an export's date range: both ends present (except tax), ordered, and at most a year. */
export function parseRange(from: string | null, to: string | null, needed: boolean): { from: string | null; to: string | null } | { error: string } {
  if (!needed) return { from: null, to: null };
  if (!from || !to || !/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) return { error: "Choose a start and end date." };
  const a = new Date(`${from}T00:00:00Z`);
  const b = new Date(`${to}T00:00:00Z`);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime()) || a > b) return { error: "The start date must be before the end date." };
  if ((b.getTime() - a.getTime()) / 86_400_000 > MAX_EXPORT_DAYS) return { error: "Choose a range of at most one year." };
  return { from: `${from}T00:00:00Z`, to: `${to}T23:59:59.999Z` };
}
