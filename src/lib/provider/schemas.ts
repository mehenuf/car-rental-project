import { z } from "zod";
import { CURRENCY_EXPONENTS } from "@/lib/pricing/money";

const documentKinds = ["business_licence", "id_document", "drivers_licence", "vehicle_registration", "insurance"] as const;

function isTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export const ApplySchema = z.object({
  type: z.enum(["company", "individual"]),
  legal_name: z.string().trim().min(2).max(120),
  display_name: z.string().trim().min(2).max(80),
  country_code: z.string().trim().length(2).transform((v) => v.toUpperCase()),
  currency: z
    .string()
    .trim()
    .length(3)
    .transform((v) => v.toUpperCase())
    .refine((v) => v in CURRENCY_EXPONENTS, "This currency is not supported yet."),
  contact_phone: z.string().trim().min(5).max(30),
  registration_number: z.string().trim().max(60).nullable().optional(),
  branch: z.object({
    name: z.string().trim().min(2).max(80),
    city: z.string().trim().min(2).max(80),
    address: z.string().trim().min(5).max(200),
    timezone: z.string().trim().default("UTC").refine(isTimeZone, "Unknown time zone."),
  }),
});

export const DocumentUploadSchema = z.object({
  kind: z.enum(documentKinds),
  file_name: z.string().trim().min(1).max(200),
  mime_type: z.string().trim().min(1).max(100),
  size_bytes: z.coerce.number().int().positive(),
  fleet_unit_id: z.uuid().nullable().optional(),
});

export const ProviderReviewSchema = z.object({
  decision: z.enum(["approve", "reject", "suspend", "reinstate"]),
  note: z.string().trim().max(500).nullable().optional(),
});

export const DocumentReviewSchema = z.object({
  status: z.enum(["accepted", "rejected"]),
  note: z.string().trim().max(500).nullable().optional(),
});

export const UnitReviewSchema = z.object({
  decision: z.enum(["approve", "reject"]),
  note: z.string().trim().max(500).nullable().optional(),
});

export const SwitchProviderSchema = z.object({ provider_id: z.uuid() });
export const IdParamSchema = z.object({ id: z.uuid() });

// ---------------------------------------------------------------
// Portal: fleet, branches, availability, settings
// ---------------------------------------------------------------

const DateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "must be YYYY-MM-DD").refine((v) => !Number.isNaN(Date.parse(v)), "must be a real date");

export const CreateUnitSchema = z.object({
  vehicle_id: z.uuid(),
  branch_id: z.coerce.number().int().positive(),
  plate: z.string().trim().min(2).max(20),
  vin: z.string().trim().min(5).max(30).nullable().optional(),
  /** Needed only when this provider has no price yet for this model at this branch (major units, e.g. 48.50). */
  daily_price: z.coerce.number().positive().max(1_000_000).nullable().optional(),
});

export const UpdateUnitSchema = z.object({
  status: z.enum(["active", "maintenance", "retired"]).optional(),
  plate: z.string().trim().min(2).max(20).optional(),
  vin: z.string().trim().min(5).max(30).nullable().optional(),
});

export const CreateBranchSchema = z.object({
  name: z.string().trim().min(2).max(80),
  city: z.string().trim().min(2).max(80),
  address: z.string().trim().min(5).max(200),
  timezone: z.string().trim().default("UTC").refine(isTimeZone, "Unknown time zone."),
});

export const UpdateBranchSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  address: z.string().trim().min(5).max(200).optional(),
  turnaround_minutes: z.coerce.number().int().min(0).max(720).optional(),
  /** Major units of the branch currency, e.g. 15 for a 15.00 airport surcharge. */
  pickup_surcharge: z.coerce.number().min(0).max(100_000).optional(),
  is_active: z.boolean().optional(),
});

export const PayoutAccountSchema = z.object({
  account_holder: z.string().trim().min(2).max(120),
  bank_name: z.string().trim().min(2).max(120),
  /** Only the last four digits are kept; the full number is never stored. */
  account_number: z.string().trim().regex(/^[A-Za-z0-9]{6,34}$/, "Enter a valid account number or IBAN."),
  country_code: z.string().trim().length(2).transform((v) => v.toUpperCase()),
});

export const ProfileSchema = z.object({
  display_name: z.string().trim().min(2).max(80).optional(),
  contact_phone: z.string().trim().min(5).max(30).optional(),
});

export const AvailabilitySchema = z
  .object({
    kind: z.enum(["window", "block"]),
    fleet_unit_id: z.uuid(),
    start_date: DateOnly,
    /** The last day included. */
    end_date: DateOnly,
    block_reason: z.enum(["maintenance", "owner_block"]).optional(),
  })
  .refine((v) => v.end_date >= v.start_date, { message: "end_date must not be before start_date", path: ["end_date"] })
  .refine((v) => (Date.parse(v.end_date) - Date.parse(v.start_date)) / 86_400_000 <= 365, {
    message: "A single period can be at most a year long.",
    path: ["end_date"],
  })
  .refine((v) => v.kind === "window" || v.block_reason !== undefined, { message: "block_reason is required for a block", path: ["block_reason"] });

export const CalendarQuerySchema = z.object({
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).optional(),
});
