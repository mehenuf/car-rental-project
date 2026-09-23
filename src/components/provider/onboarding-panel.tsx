"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Clock, FileUp, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/provider";
import { documentProblem, missingDocuments } from "@/lib/provider/onboarding";
import { supabase } from "@/lib/supabase";
import type { DocumentKind, ProviderStatus, ProviderType } from "@/types/database";

export interface OnboardingDocument {
  id: string;
  kind: DocumentKind;
  file_name: string;
  status: "pending" | "accepted" | "rejected";
  review_note: string | null;
}

const REQUIRED: Record<ProviderType, DocumentKind[]> = {
  company: ["business_licence", "id_document"],
  individual: ["id_document", "drivers_licence"],
};

const PROBLEM_KEY = { type: "portal.apply.problemType", empty: "portal.apply.problemEmpty", size: "portal.apply.problemSize" } as const;

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
  const t = useT();
  const router = useRouter();
  const [busyKind, setBusyKind] = useState<DocumentKind | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputs = useRef<Partial<Record<DocumentKind, HTMLInputElement | null>>>({});

  const editable = status === "draft" || status === "rejected";
  const missing = missingDocuments(type, documents);
  const label = (kind: DocumentKind) => t(`portal.docs.kind_${kind}`);

  async function upload(kind: DocumentKind, file: File) {
    setError(null);
    const problem = documentProblem({ mimeType: file.type, sizeBytes: file.size });
    if (problem) return setError(t(PROBLEM_KEY[problem]));

    setBusyKind(kind);
    try {
      const res = await fetch("/api/provider/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, file_name: file.name, mime_type: file.type, size_bytes: file.size }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error?.message ?? t("portal.apply.uploadStartFailed"));

      // The file goes straight to private storage with a one-time token.
      const { error: uploadError } = await supabase.storage.from(body.bucket).uploadToSignedUrl(body.path, body.token, file);
      if (uploadError) throw new Error(uploadError.message);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("portal.apply.uploadFailed"));
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
      if (!res.ok) throw new Error(body?.error?.message ?? t("portal.apply.submitFailed"));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("portal.apply.submitFailed"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-(--space-md)">
      <div className="rounded-xl border border-border p-(--space-sm)">
        <p className="text-sm text-foreground">{t(`portal.apply.status_${status}`)}</p>
        {status === "rejected" && reviewNote && (
          <p className="mt-2 text-sm text-destructive">{t("portal.apply.reviewerNote", { note: reviewNote })}</p>
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
                  <span className="font-medium text-foreground">{label(kind)}</span>
                  <span className="text-sm text-muted-foreground">
                    {latest ? t("portal.docs.fileLine", { file: latest.file_name, status: t(`portal.docs.status_${latest.status}`) }) : t("portal.apply.notUploaded")}
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
                    aria-label={t("portal.apply.uploadAria", { kind: label(kind) })}
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
                    {busyKind === kind ? t("portal.apply.uploading") : latest ? t("portal.apply.replace") : t("portal.apply.upload")}
                  </Button>
                </>
              )}
            </li>
          );
        })}
      </ul>
      <p className="text-xs text-muted-foreground">{t("portal.apply.fileHint")}</p>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      {editable && (
        <Button type="button" size="lg" className="self-start" disabled={missing.length > 0 || submitting} onClick={submit}>
          {submitting ? t("portal.apply.submitting") : status === "rejected" ? t("portal.apply.submitAgain") : t("portal.apply.submit")}
        </Button>
      )}
    </div>
  );
}
