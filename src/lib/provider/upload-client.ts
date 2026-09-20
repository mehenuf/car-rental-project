import { supabase } from "@/lib/supabase";
import { validateDocument } from "@/lib/provider/onboarding";
import type { DocumentKind } from "@/types/database";

/**
 * Registers a document with the server (which checks the type, size and that
 * the car is yours), then uploads the file straight to private storage with the
 * one-time token it returns. Throws an Error with a customer-facing message.
 */
export async function uploadDocument(args: { kind: DocumentKind; file: File; fleetUnitId?: string | null }): Promise<void> {
  const problem = validateDocument({ mimeType: args.file.type, sizeBytes: args.file.size });
  if (problem) throw new Error(problem);

  const res = await fetch("/api/provider/documents", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      kind: args.kind,
      file_name: args.file.name,
      mime_type: args.file.type,
      size_bytes: args.file.size,
      fleet_unit_id: args.fleetUnitId ?? null,
    }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body?.error?.message ?? "Could not start the upload.");

  const { error } = await supabase.storage.from(body.bucket).uploadToSignedUrl(body.path, body.token, args.file);
  if (error) throw new Error(error.message);
}
