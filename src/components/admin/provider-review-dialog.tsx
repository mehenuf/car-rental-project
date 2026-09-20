"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useApiData } from "@/hooks/use-api-data";
import { canTransitionProvider } from "@/lib/provider/onboarding";
import type { ProviderStatus } from "@/types/database";

interface Detail {
  provider: {
    id: string;
    type: "company" | "individual";
    legal_name: string;
    display_name: string;
    country_code: string;
    default_currency: string;
    status: ProviderStatus;
    contact_phone: string | null;
    registration_number: string | null;
    review_note: string | null;
  };
  documents: { id: string; fleet_unit_id: string | null; kind: string; file_name: string; status: string; review_note: string | null }[];
  branches: { id: number; name: string; city: string; country: string; currency: string }[];
  cars: { id: string; plate: string; vehicle_name: string; listing_status: string; review_note: string | null }[];
}

async function post(url: string, body: unknown): Promise<void> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.error?.message ?? "Request failed");
  }
}

/** Everything a reviewer needs to decide on one provider, and the buttons to decide. */
export function ProviderReviewDialog({
  providerId,
  onClose,
  onChanged,
}: {
  providerId: string | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [refresh, setRefresh] = useState(0);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const result = useApiData<Detail>(providerId ? `/api/admin/providers/${providerId}?_r=${refresh}` : null);

  async function act(fn: () => Promise<void>) {
    setError(null);
    setBusy(true);
    try {
      await fn();
      setNote("");
      setRefresh((n) => n + 1);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function view(documentId: string) {
    setError(null);
    const res = await fetch(`/api/admin/documents/${documentId}/url`);
    const body = await res.json();
    if (!res.ok) return setError(body?.error?.message ?? "Could not open the file.");
    window.open(body.url, "_blank", "noopener");
  }

  const detail = result.status === "success" ? result.data : null;
  const status = detail?.provider.status;
  const reason = note.trim() || null;

  return (
    <Dialog open={providerId !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{detail?.provider.display_name ?? "Provider"}</DialogTitle>
          <DialogDescription>
            {detail
              ? `${detail.provider.type === "company" ? "Company" : "Private owner"} · ${detail.provider.country_code} · ${detail.provider.default_currency} · ${status?.replace("_", " ")}`
              : "Loading..."}
          </DialogDescription>
        </DialogHeader>

        {result.status === "error" && <p className="text-sm text-destructive">{result.error}</p>}

        {detail && (
          <div className="flex flex-col gap-(--space-sm) text-sm">
            <div className="text-muted-foreground">
              {detail.provider.legal_name}
              {detail.provider.registration_number ? ` · Reg. ${detail.provider.registration_number}` : ""}
              {detail.provider.contact_phone ? ` · ${detail.provider.contact_phone}` : ""}
              {detail.provider.review_note ? ` · Last note: ${detail.provider.review_note}` : ""}
            </div>

            <section className="flex flex-col gap-2">
              <h3 className="font-medium text-foreground">Documents</h3>
              {detail.documents.length === 0 && <p className="text-muted-foreground">None uploaded.</p>}
              {detail.documents.map((doc) => (
                <div key={doc.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-2">
                  <span>
                    {doc.kind.replace(/_/g, " ")} <span className="text-muted-foreground">({doc.file_name}, {doc.status})</span>
                    {doc.review_note && <span className="block text-destructive">{doc.review_note}</span>}
                  </span>
                  <span className="flex gap-1.5">
                    <Button type="button" size="sm" variant="outline" onClick={() => view(doc.id)}>View</Button>
                    <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => act(() => post(`/api/admin/documents/${doc.id}/review`, { status: "accepted" }))}>Accept</Button>
                    <Button type="button" size="sm" variant="outline" disabled={busy || !reason} onClick={() => act(() => post(`/api/admin/documents/${doc.id}/review`, { status: "rejected", note: reason }))}>Reject</Button>
                  </span>
                </div>
              ))}
            </section>

            {detail.cars.length > 0 && (
              <section className="flex flex-col gap-2">
                <h3 className="font-medium text-foreground">Cars</h3>
                {detail.cars.map((car) => (
                  <div key={car.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-2">
                    <span>
                      {car.vehicle_name} <span className="text-muted-foreground">({car.plate}, {car.listing_status.replace("_", " ")})</span>
                      {car.review_note && <span className="block text-destructive">{car.review_note}</span>}
                    </span>
                    {car.listing_status === "pending_review" && (
                      <span className="flex gap-1.5">
                        <Button type="button" size="sm" disabled={busy} onClick={() => act(() => post(`/api/admin/units/${car.id}/review`, { decision: "approve" }))}>Approve car</Button>
                        <Button type="button" size="sm" variant="outline" disabled={busy || !reason} onClick={() => act(() => post(`/api/admin/units/${car.id}/review`, { decision: "reject", note: reason }))}>Reject car</Button>
                      </span>
                    )}
                  </div>
                ))}
              </section>
            )}

            <section className="flex flex-col gap-2">
              <h3 className="font-medium text-foreground">Decision</h3>
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Reason (required to reject or suspend; shown to the provider)"
                rows={2}
                aria-label="Reason"
              />
              <div className="flex flex-wrap gap-2">
                {status && canTransitionProvider(status, "approved") && (
                  <Button type="button" disabled={busy} onClick={() => act(() => post(`/api/admin/providers/${detail.provider.id}/review`, { decision: status === "suspended" ? "reinstate" : "approve", note: reason }))}>
                    {status === "suspended" ? "Reinstate" : "Approve"}
                  </Button>
                )}
                {status && canTransitionProvider(status, "rejected") && (
                  <Button type="button" variant="outline" disabled={busy || !reason} onClick={() => act(() => post(`/api/admin/providers/${detail.provider.id}/review`, { decision: "reject", note: reason }))}>
                    Reject
                  </Button>
                )}
                {status && canTransitionProvider(status, "suspended") && (
                  <Button type="button" variant="destructive" disabled={busy || !reason} onClick={() => act(() => post(`/api/admin/providers/${detail.provider.id}/review`, { decision: "suspend", note: reason }))}>
                    Suspend
                  </Button>
                )}
              </div>
            </section>
          </div>
        )}

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
