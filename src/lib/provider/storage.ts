import "server-only";
import { ApiError } from "@/lib/errors";
import { supabaseAdmin } from "@/lib/supabase-server";

export const DOCUMENT_BUCKET = "provider-documents";
export const INSPECTION_BUCKET = "booking-inspections";

/** A one-time URL the browser can upload a single file to, valid for a short while. */
export async function createUploadUrl(bucket: string, path: string): Promise<{ signedUrl: string; token: string }> {
  const { data, error } = await supabaseAdmin.storage.from(bucket).createSignedUploadUrl(path);
  if (error || !data) throw new Error(`createUploadUrl: ${error?.message ?? "no url"}`);
  return { signedUrl: data.signedUrl, token: data.token };
}

/** A short-lived link for viewing a private file. */
export async function createDownloadUrl(bucket: string, path: string, seconds = 60): Promise<string> {
  const { data, error } = await supabaseAdmin.storage.from(bucket).createSignedUrl(path, seconds);
  if (error || !data) throw new ApiError(404, "File not found.");
  return data.signedUrl;
}

/** True when an object exists at `path` (a signed URL cannot be made for a missing object). */
export async function objectExists(bucket: string, path: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin.storage.from(bucket).createSignedUrl(path, 5);
  return Boolean(data) && !error;
}

