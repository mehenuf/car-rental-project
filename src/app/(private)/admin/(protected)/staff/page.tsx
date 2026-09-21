"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useApiData } from "@/hooks/use-api-data";

interface Member {
  user_id: string;
  role: string;
  email: string | null;
  disabled_at: string | null;
}

async function post(body: Record<string, unknown>): Promise<string | null> {
  const res = await fetch("/api/admin/staff", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (res.ok) return null;
  const json = await res.json().catch(() => null);
  return json?.error?.message ?? "Something went wrong.";
}

export default function AdminStaffPage() {
  const [refresh, setRefresh] = useState(0);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("support");
  const [message, setMessage] = useState<string | null>(null);
  const result = useApiData<{ data: Member[]; roles: string[] }>(`/api/admin/staff?_r=${refresh}`);
  const data = result.status === "success" ? result.data : null;

  async function run(body: Record<string, unknown>) {
    const error = await post(body);
    setMessage(error);
    if (!error) setRefresh((n) => n + 1);
  }

  return (
    <div className="flex flex-col gap-(--space-md)">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-bold text-foreground">Staff</h1>
        <p className="text-sm text-muted-foreground">
          Reviewer: providers, cars, licences, reviews, reports, risk and disputes. Support: customers and bookings, small refunds. Finance: payments, payouts, reports, exports and fees. Super admin: everything, including staff and settings. Two-factor sign-in is required only when ADMIN_REQUIRE_MFA is set to true; it is off by default.
        </p>
      </div>
      {message && <p role="alert" className="text-sm text-destructive">{message}</p>}
      {result.status === "error" && <p className="text-sm text-destructive">{result.error}</p>}

      <Card className="shadow-card ring-0">
        <CardContent className="flex flex-wrap items-end gap-2">
          <Input aria-label="Email of an existing account" placeholder="Email of an existing account" value={email} onChange={(e) => setEmail(e.target.value)} className="min-w-64 flex-1" />
          <select aria-label="Role" value={role} onChange={(e) => setRole(e.target.value)} className="h-9 rounded-lg border border-input bg-transparent px-2.5 text-sm">
            {(data?.roles ?? ["support", "finance", "reviewer", "super_admin"]).map((r) => <option key={r} value={r}>{r.replace("_", " ")}</option>)}
          </select>
          <Button type="button" size="sm" disabled={!email.trim()} onClick={() => void run({ action: "add", email, role }).then(() => setEmail(""))}>Add staff member</Button>
        </CardContent>
      </Card>

      {data?.data.map((m) => (
        <Card key={m.user_id} className="shadow-card ring-0">
          <CardContent className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-foreground">{m.email ?? m.user_id} · <span className="font-medium">{m.role.replace("_", " ")}</span>{m.disabled_at ? " · disabled" : ""}</p>
            <div className="flex flex-wrap items-center gap-2">
              <select aria-label={`Role for ${m.email ?? m.user_id}`} value={m.role} onChange={(e) => void run({ action: "set_role", user_id: m.user_id, role: e.target.value })} className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm">
                {data.roles.map((r) => <option key={r} value={r}>{r.replace("_", " ")}</option>)}
              </select>
              {m.disabled_at ? (
                <Button type="button" size="sm" variant="outline" onClick={() => void run({ action: "enable", user_id: m.user_id })}>Enable</Button>
              ) : (
                <Button type="button" size="sm" variant="outline" onClick={() => void run({ action: "disable", user_id: m.user_id })}>Disable</Button>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
