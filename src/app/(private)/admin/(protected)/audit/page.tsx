"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useApiData } from "@/hooks/use-api-data";
import { formatDate } from "@/lib/format";

interface Entry {
  id: number;
  at: string;
  actor_user_id: string | null;
  actor_role: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  before: unknown;
  after: unknown;
  reason: string | null;
  ip: string | null;
}

export default function AdminAuditPage() {
  const [entity, setEntity] = useState("");
  const [action, setAction] = useState("");
  const [actor, setActor] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<number | null>(null);

  const params = new URLSearchParams({ page: String(page) });
  for (const [k, v] of Object.entries({ entity, action, actor, from, to })) if (v) params.set(k, v);
  const result = useApiData<{ data: Entry[]; count: number; pageSize: number }>(`/api/admin/audit?${params.toString()}`);
  const data = result.status === "success" ? result.data : null;
  const pages = data ? Math.max(1, Math.ceil(data.count / data.pageSize)) : 1;

  return (
    <div className="flex flex-col gap-(--space-md)">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-bold text-foreground">Audit log</h1>
        <p className="text-sm text-muted-foreground">Every staff action and sensitive system change. The log can only be added to; nothing can edit or delete an entry.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Input aria-label="Entity" placeholder="Entity (e.g. provider)" value={entity} onChange={(e) => { setEntity(e.target.value); setPage(1); }} className="w-44" />
        <Input aria-label="Action" placeholder="Action starts with" value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }} className="w-44" />
        <Input aria-label="Actor id" placeholder="Actor user id" value={actor} onChange={(e) => { setActor(e.target.value.trim()); setPage(1); }} className="w-72" />
        <Input aria-label="From" type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} className="w-40" />
        <Input aria-label="To" type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} className="w-40" />
      </div>
      {result.status === "error" && <p className="text-sm text-destructive">{result.error}</p>}
      {data?.data.length === 0 && <p className="text-sm text-muted-foreground">No entries match.</p>}
      {data?.data.map((e) => (
        <Card key={e.id} className="shadow-card ring-0">
          <CardContent className="flex flex-col gap-1">
            <button type="button" className="flex flex-wrap items-center justify-between gap-2 text-start" onClick={() => setOpen(open === e.id ? null : e.id)} aria-expanded={open === e.id}>
              <span className="font-medium text-foreground">{e.action}</span>
              <span className="text-xs text-muted-foreground">{formatDate(e.at)} · {e.actor_role ?? "unknown"} · {e.entity_type} {e.entity_id ?? ""}</span>
            </button>
            {e.reason && <p className="text-sm text-muted-foreground">Reason: {e.reason}</p>}
            {open === e.id && (
              <pre className="max-h-64 overflow-auto rounded-lg bg-muted p-2 text-xs">{JSON.stringify({ actor: e.actor_user_id, ip: e.ip, before: e.before, after: e.after }, null, 2)}</pre>
            )}
          </CardContent>
        </Card>
      ))}
      <div className="flex items-center gap-2">
        <Button type="button" size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
        <span className="text-sm text-muted-foreground">Page {page} of {pages}</span>
        <Button type="button" size="sm" variant="outline" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</Button>
      </div>
    </div>
  );
}
