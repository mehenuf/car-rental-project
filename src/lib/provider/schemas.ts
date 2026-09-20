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
