"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useApiData } from "@/hooks/use-api-data";
import { formatDate } from "@/lib/format";

interface Row {
  user_id: string;
  date_of_birth: string;
  licence_country: string;
  licence_number_last4: string;
  licence_expiry: string;
  submitted_at: string;
  documents: { id: string; kind: string }[];
}

export default function AdminLicencesPage() {
  const [refresh, setRefresh] = useState(0);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const result = useApiData<{ data: Row[] }>(`/api/admin/licences?_r=${refresh}`);
  const rows = result.status === "success" ? result.data.data : [];

  async function openDocument(userId: string, id: string) {
    const res = await fetch(`/api/admin/licences/${userId}/documents/${id}`);
    const body = await res.json();
    if (res.ok) window.open(body.url, "_blank", "noopener");
    else setMessage(body?.error?.message ?? "Could not open the file.");
  }

  async function decide(userId: string, decision: "approve" | "reject") {
    setMessage(null);
    const res = await fetch(`/api/admin/licences/${userId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision, note: notes[userId] || undefined }),
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      setMessage(body?.error?.message ?? "Could not save the decision.");
      return;
    }
    setRefresh((n) => n + 1);
  }

  return (
    <div className="flex flex-col gap-(--space-md)">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-bold text-foreground">Driver&apos;s licences</h1>
        <p className="text-sm text-muted-foreground">Check the photos against the details, then approve or reject. Files open in a new tab for 60 seconds.</p>
      </div>
      {message && <p role="alert" className="text-sm text-destructive">{message}</p>}
      {result.status === "loading" && <p className="text-sm text-muted-foreground">Loading...</p>}
      {result.status === "error" && <p className="text-sm text-destructive">{result.error}</p>}
      {result.status === "success" && rows.length === 0 && <p className="text-sm text-muted-foreground">Nothing is waiting for review.</p>}
      {rows.map((row) => (
        <Card key={row.user_id} className="shadow-card ring-0">
          <CardContent className="flex flex-col gap-(--space-xs)">
            <p className="text-sm">
              Born {row.date_of_birth} · {row.licence_country} licence ending {row.licence_number_last4} · expires {row.licence_expiry} · submitted {formatDate(row.submitted_at)}
            </p>
            <div className="flex flex-wrap gap-2">
              {row.documents.map((d) => (
                <Button key={d.id} type="button" variant="outline" size="sm" onClick={() => openDocument(row.user_id, d.id)}>
                  {d.kind.replace("_", " ")}
                </Button>
              ))}
            </div>
            <Input
              aria-label="Note (required to reject)"
              placeholder="Note (required to reject)"
              value={notes[row.user_id] ?? ""}
              onChange={(e) => setNotes((n) => ({ ...n, [row.user_id]: e.target.value }))}
            />
            <div className="flex gap-2">
              <Button type="button" size="sm" onClick={() => decide(row.user_id, "approve")}>Approve</Button>
              <Button type="button" size="sm" variant="destructive" onClick={() => decide(row.user_id, "reject")}>Reject</Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
