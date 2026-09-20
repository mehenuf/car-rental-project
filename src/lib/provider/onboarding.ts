import type { DocumentKind, ProviderStatus, ProviderType } from "@/types/database";

// ---------------------------------------------------------------
// Provider status machine
// ---------------------------------------------------------------

const TRANSITIONS: Record<ProviderStatus, readonly ProviderStatus[]> = {
  draft: ["submitted"],
  submitted: ["under_review", "approved", "rejected"],
  under_review: ["approved", "rejected"],
  approved: ["suspended"],
  rejected: ["submitted"], // fix the problems and resubmit
  suspended: ["approved"],
};

export function canTransitionProvider(from: ProviderStatus, to: ProviderStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export type ReviewDecision = "approve" | "reject" | "suspend" | "reinstate";

/** Maps an admin decision to the provider's next status. Reject and suspend must come with a reason. */
export function decisionToStatus(decision: ReviewDecision, note: string | null): ProviderStatus {
  if ((decision === "reject" || decision === "suspend") && !note?.trim()) {
    throw new Error("A reason is required to reject or suspend a provider.");
  }
  switch (decision) {
    case "approve":
    case "reinstate":
      return "approved";
    case "reject":
      return "rejected";
    case "suspend":
      return "suspended";
  }
}

// ---------------------------------------------------------------
// Required documents
// ---------------------------------------------------------------

const REQUIRED_BY_TYPE: Record<ProviderType, readonly DocumentKind[]> = {
  company: ["business_licence", "id_document"],
  individual: ["id_document", "drivers_licence"],
};

const REQUIRED_PER_CAR: readonly DocumentKind[] = ["vehicle_registration", "insurance"];

interface DocumentLike {
  kind: DocumentKind;
  status: "pending" | "accepted" | "rejected";
}

function missing(required: readonly DocumentKind[], documents: readonly DocumentLike[]): DocumentKind[] {
  // A rejected document does not count: the provider must upload a replacement.
  const have = new Set(documents.filter((d) => d.status !== "rejected").map((d) => d.kind));
  return required.filter((kind) => !have.has(kind));
}

export function missingDocuments(type: ProviderType, documents: readonly DocumentLike[]): DocumentKind[] {
  return missing(REQUIRED_BY_TYPE[type], documents);
}

export function missingUnitDocuments(documents: readonly DocumentLike[]): DocumentKind[] {
  return missing(REQUIRED_PER_CAR, documents);
}

// ---------------------------------------------------------------
// Upload validation and storage paths
// ---------------------------------------------------------------

export const ALLOWED_MIME_TYPES = ["application/pdf", "image/jpeg", "image/png"] as const;
export const MAX_DOCUMENT_BYTES = 5 * 1024 * 1024;

/** Returns a customer-facing problem, or null when the file may be uploaded. */
export function validateDocument(file: { mimeType: string; sizeBytes: number }): string | null {
  if (!(ALLOWED_MIME_TYPES as readonly string[]).includes(file.mimeType)) return "Only PDF, JPG or PNG files are accepted.";
  if (file.sizeBytes <= 0) return "The file is empty.";
  if (file.sizeBytes > MAX_DOCUMENT_BYTES) return "Files must be 5 MB or smaller.";
  return null;
}

/** `{owner id}/{unique id}-{safe file name}`: no user-controlled path segments, no traversal, bounded length. */
export function buildStoragePath(ownerId: string, fileName: string, uniqueId: string): string {
  const lower = fileName.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/\.{2,}/g, ".").replace(/^\.+/, "");
  const dot = lower.lastIndexOf(".");
  const ext = dot > 0 ? lower.slice(dot) : "";
  const base = (dot > 0 ? lower.slice(0, dot) : lower).slice(0, Math.max(1, 80 - ext.length)) || "file";
  return `${ownerId}/${uniqueId}-${base}${ext}`;
}
