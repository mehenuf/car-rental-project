import { z } from "zod";
import { ageOn } from "./age";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

function isRealDate(value: string): boolean {
  if (!DATE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

/** Built per request so "expired" and "old enough" are judged against the current day. */
export function DriverProfileInputSchema(now: Date = new Date()) {
  const today = now.toISOString().slice(0, 10);
  return z.object({
    date_of_birth: z
      .string()
      .refine(isRealDate, "Enter a valid date of birth")
      .refine((v) => {
        const age = ageOn(v, now, "UTC");
        return age >= 16 && age <= 110;
      }, "Enter a valid date of birth"),
    licence_country: z.string().trim().length(2, "Use a two-letter country code").transform((v) => v.toUpperCase()),
    licence_number_last4: z
      .string()
      .trim()
      .regex(/^[A-Za-z0-9]{4}$/, "Enter the last four characters of the licence number")
      .transform((v) => v.toUpperCase()),
    licence_expiry: z
      .string()
      .refine(isRealDate, "Enter a valid expiry date")
      .refine((v) => v >= today, "This licence has expired"),
  });
}

export const DRIVER_DOCUMENT_MAX_BYTES = 5 * 1024 * 1024;

export const DriverDocumentUploadSchema = z
  .object({
    kind: z.enum(["licence_front", "licence_back", "selfie"]),
    file_name: z.string().trim().min(1).max(200),
    mime_type: z.enum(["image/jpeg", "image/png", "image/webp", "application/pdf"]),
    size_bytes: z.coerce.number().int().positive().max(DRIVER_DOCUMENT_MAX_BYTES),
  })
  .refine((v) => v.kind !== "selfie" || v.mime_type !== "application/pdf", {
    message: "A selfie must be a photo",
    path: ["mime_type"],
  });

export const LicenceReviewSchema = z
  .object({
    decision: z.enum(["approve", "reject"]),
    note: z.string().trim().max(500).optional(),
  })
  .refine((v) => v.decision === "approve" || Boolean(v.note), {
    message: "Say why the licence was rejected",
    path: ["note"],
  });

/**
 * "verify": accounts start unconfirmed and the customer clicks the link Supabase emails (needs SMTP,
 * see the rollout notes). "preconfirm": the old behaviour, for demos with no email provider yet.
 */
export function signupMode(env: Record<string, string | undefined>): "verify" | "preconfirm" {
  return env.AUTH_REQUIRE_EMAIL_VERIFICATION === "false" ? "preconfirm" : "verify";
}
