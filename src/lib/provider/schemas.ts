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

// ---------------------------------------------------------------
// Portal: pricing
// ---------------------------------------------------------------

export const RatePlanUpsertSchema = z
  .object({
    vehicle_id: z.uuid(),
    branch_id: z.coerce.number().int().positive(),
    /** Major units of the branch currency. */
    base_daily: z.coerce.number().positive().max(1_000_000),
    weekend_uplift_pct: z.coerce.number().min(0).max(100).default(0),
    weekly_discount_pct: z.coerce.number().min(0).max(90).default(0),
    monthly_discount_pct: z.coerce.number().min(0).max(90).default(0),
    min_days: z.coerce.number().int().min(1).max(365).default(1),
    max_days: z.coerce.number().int().min(1).max(365).nullable().optional(),
  })
  .refine((v) => v.max_days == null || v.max_days >= v.min_days, { message: "max_days must not be below min_days", path: ["max_days"] });

export const SeasonSchema = z
  .object({
    start_date: DateOnly,
    end_date: DateOnly,
    daily: z.coerce.number().positive().max(1_000_000),
  })
  .refine((v) => v.end_date >= v.start_date, { message: "end_date must not be before start_date", path: ["end_date"] });

const extraFields = {
  code: z.string().trim().toLowerCase().regex(/^[a-z0-9_-]{2,30}$/, "Use 2 to 30 letters, numbers, dashes or underscores."),
  name: z.string().trim().min(2).max(80),
  kind: z.enum(["extra", "insurance"]),
  pricing: z.enum(["per_day", "per_rental"]),
  unit_price: z.coerce.number().min(0).max(100_000),
  max_quantity: z.coerce.number().int().min(1).max(20).default(1),
  cap: z.coerce.number().min(0).max(1_000_000).nullable().optional(),
  is_mandatory: z.boolean().default(false),
  is_active: z.boolean().default(true),
};
export const ExtraSchema = z.object(extraFields);
export const ExtraUpdateSchema = z.object(extraFields).omit({ code: true }).partial();

export const PolicySchema = z
  .object({
    deposit_type: z.enum(["fixed", "percent"]),
    deposit_value: z.coerce.number().min(0).max(1_000_000),
    cancellation_tiers: z
      .array(z.object({ hours_before: z.coerce.number().int().min(0).max(720), refund_pct: z.coerce.number().min(0).max(100) }))
      .max(6),
    min_driver_age: z.coerce.number().int().min(16).max(30),
    young_driver_age: z.coerce.number().int().min(18).max(30).nullable(),
    young_driver_fee: z.coerce.number().min(0).max(10_000),
  })
  .refine((v) => new Set(v.cancellation_tiers.map((t) => t.hours_before)).size === v.cancellation_tiers.length, {
    message: "Each cancellation deadline can only appear once.",
    path: ["cancellation_tiers"],
  })
  .refine((v) => v.deposit_type === "fixed" || v.deposit_value <= 100, { message: "A percentage deposit cannot exceed 100%.", path: ["deposit_value"] })
  .refine((v) => v.young_driver_age === null || v.young_driver_age > v.min_driver_age, {
    message: "The young driver age must be above the minimum age.",
    path: ["young_driver_age"],
  });

export const PromoSchema = z
  .object({
    code: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{3,30}$/, "Use 3 to 30 letters and numbers."),
    discount_type: z.enum(["percent", "fixed"]),
    /** A percentage (1 to 100) or major units of the provider currency. */
    value: z.coerce.number().positive().max(1_000_000),
    min_days: z.coerce.number().int().min(1).max(365).default(1),
    valid_from: DateOnly.nullable().optional(),
    valid_to: DateOnly.nullable().optional(),
    vehicle_id: z.uuid().nullable().optional(),
  })
  .refine((v) => v.discount_type === "fixed" || v.value <= 100, { message: "A percentage discount cannot exceed 100%.", path: ["value"] })
  .refine((v) => !v.valid_from || !v.valid_to || v.valid_to >= v.valid_from, { message: "valid_to must not be before valid_from", path: ["valid_to"] });

export const PromoUpdateSchema = z.object({ is_active: z.boolean() });

export const OneWayFeeSchema = z.object({
  from_branch_id: z.coerce.number().int().positive(),
  to_branch_id: z.coerce.number().int().positive(),
  amount: z.coerce.number().min(0).max(100_000),
});

// ---------------------------------------------------------------
// Portal: team and booking operations
// ---------------------------------------------------------------

export const AddMemberSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  role: z.enum(["manager", "agent"]),
  branch_id: z.coerce.number().int().positive().nullable().optional(),
});

export const ChangeMemberSchema = z.object({ role: z.enum(["manager", "agent"]) });

export const InspectionSchema = z.object({
  kind: z.enum(["pickup", "return"]),
  odometer_km: z.coerce.number().int().min(0).max(2_000_000),
  fuel_level: z.enum(["empty", "quarter", "half", "three_quarters", "full"]),
  notes: z.string().trim().max(1000).nullable().optional(),
  photo_paths: z.array(z.string().min(1).max(300)).max(10).default([]),
  /** Pickup only: hand the car over without a verified licence on file, with a written reason. */
  licence_override_reason: z.string().trim().min(5).max(300).nullable().optional(),
});

export const InspectionPhotoSchema = z.object({
  file_name: z.string().trim().min(1).max(200),
  mime_type: z.enum(["image/jpeg", "image/png"]),
  size_bytes: z.coerce.number().int().positive(),
});

export const ProviderBookingsQuerySchema = z.object({
  view: z.enum(["upcoming", "active", "past", "all"]).default("upcoming"),
});
