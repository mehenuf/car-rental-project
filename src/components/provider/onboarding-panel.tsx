"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Clock, FileUp, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { missingDocuments, validateDocument } from "@/lib/provider/onboarding";
import { supabase } from "@/lib/supabase";
import type { DocumentKind, ProviderStatus, ProviderType } from "@/types/database";

export interface OnboardingDocument {
  id: string;
  kind: DocumentKind;
  file_name: string;
  status: "pending" | "accepted" | "rejected";
  review_note: string | null;
}

const LABELS: Record<DocumentKind, string> = {
  business_licence: "Business licence",
  id_document: "Government ID",
  drivers_licence: "Driver's licence",
  vehicle_registration: "Vehicle registration",
  insurance: "Insurance certificate",
};

const REQUIRED: Record<ProviderType, DocumentKind[]> = {
  company: ["business_licence", "id_document"],
  individual: ["id_document", "drivers_licence"],
};

const STATUS_COPY: Record<ProviderStatus, string> = {
  draft: "Upload your documents, then submit your application for review.",
  submitted: "Your application is with our team. We will review it soon.",
  under_review: "Your application is being reviewed.",
  approved: "Your account is approved.",
  rejected: "Your application needs changes. Fix the points below and submit it again.",
  suspended: "Your account is suspended. Contact support to find out why.",
};

/** Step two: upload the required documents and send the application for review. */
export function OnboardingPanel({
  type,
  status,
  reviewNote,
  documents,
}: {
  type: ProviderType;
  status: ProviderStatus;
  reviewNote: string | null;
  documents: OnboardingDocument[];
}) {
  const router = useRouter();
  const [busyKind, setBusyKind] = useState<DocumentKind | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputs = useRef<Partial<Record<DocumentKind, HTMLInputElement | null>>>({});

  const editable = status === "draft" || status === "rejected";
  const missing = missingDocuments(type, documents);

  async function upload(kind: DocumentKind, file: File) {
    setError(null);
    const problem = validateDocument({ mimeType: file.type, sizeBytes: file.size });
    if (problem) return setError(problem);

    setBusyKind(kind);
    try {
      const res = await fetch("/api/provider/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, file_name: file.name, mime_type: file.type, size_bytes: file.size }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error?.message ?? "Could not start the upload.");

      // The file goes straight to private storage with a one-time token.
      const { error: uploadError } = await supabase.storage.from(body.bucket).uploadToSignedUrl(body.path, body.token, file);
      if (uploadError) throw new Error(uploadError.message);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "The upload failed.");
    } finally {
      setBusyKind(null);
    }
  }

  async function submit() {
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/provider/submit", { method: "POST" });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error?.message ?? "Could not submit your application.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit your application.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-(--space-md)">
      <div className="rounded-xl border border-border p-(--space-sm)">
        <p className="text-sm text-foreground">{STATUS_COPY[status]}</p>
        {status === "rejected" && reviewNote && (
          <p className="mt-2 text-sm text-destructive">Reviewer note: {reviewNote}</p>
        )}
      </div>

      <ul className="flex flex-col gap-(--space-xs)">
        {REQUIRED[type].map((kind) => {
          const mine = documents.filter((d) => d.kind === kind);
          const latest = mine[mine.length - 1];
          const Icon = !latest ? FileUp : latest.status === "accepted" ? CheckCircle2 : latest.status === "rejected" ? XCircle : Clock;
          return (
            <li key={kind} className="flex flex-col gap-2 rounded-xl border border-border p-(--space-sm) sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <Icon className="mt-0.5 size-5 shrink-0 text-accent-text" aria-hidden />
                <div className="flex flex-col">
                  <span className="font-medium text-foreground">{LABELS[kind]}</span>
                  <span className="text-sm text-muted-foreground">
                    {latest ? `${latest.file_name} (${latest.status})` : "Not uploaded yet"}
                  </span>
                  {latest?.status === "rejected" && latest.review_note && (
                    <span className="text-sm text-destructive">{latest.review_note}</span>
                  )}
                </div>
              </div>
              {editable && (
                <>
                  <input
                    ref={(el) => {
                      inputs.current[kind] = el;
                    }}
                    type="file"
                    accept="application/pdf,image/jpeg,image/png"
                    className="sr-only"
                    aria-label={`Upload ${LABELS[kind]}`}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void upload(kind, file);
                      e.target.value = "";
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={busyKind !== null}
                    onClick={() => inputs.current[kind]?.click()}
                  >
                    {busyKind === kind ? "Uploading..." : latest ? "Replace" : "Upload"}
                  </Button>
                </>
              )}
            </li>
          );
        })}
      </ul>
      <p className="text-xs text-muted-foreground">PDF, JPG or PNG, up to 5 MB each. Files are stored privately and only our review team can open them.</p>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      {editable && (
        <Button type="button" size="lg" className="self-start" disabled={missing.length > 0 || submitting} onClick={submit}>
          {submitting ? "Submitting..." : status === "rejected" ? "Submit again" : "Submit for review"}
        </Button>
      )}
    </div>
  );
}
