"use client";

import { useState, type FormEvent } from "react";
import { Trash2 } from "lucide-react";
import { Status, send, useSave } from "@/components/provider/form-utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useApiData } from "@/hooks/use-api-data";
import { useT } from "@/lib/i18n/provider";

interface Member {
  user_id: string;
  role: "owner" | "manager" | "agent";
  branch_id: number | null;
  email: string | null;
  name: string | null;
}

const selectClass = "h-9 rounded-lg border border-input bg-transparent px-2.5 text-sm";

/** Who can act for this provider, and as what. Only owners see this page. */
export function TeamManager({ currentUserId }: { currentUserId: string }) {
  const t = useT();
  const [refresh, setRefresh] = useState(0);
  const team = useApiData<{ data: Member[] }>(`/api/provider/team?_r=${refresh}`);
  const branches = useApiData<{ data: { id: number; name: string }[] }>("/api/provider/branches");
  const [f, setF] = useState({ email: "", role: "manager", branch: "" });
  const save = useSave();
  const [message, setMessage] = useState<string | null>(null);
  const changed = () => setRefresh((n) => n + 1);

  async function act(fn: () => Promise<void>) {
    setMessage(null);
    try {
      await fn();
      changed();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : t("portal.common.somethingWrong"));
    }
  }

  function add(e: FormEvent) {
    e.preventDefault();
    void save.run(async () => {
      await send("/api/provider/team", "POST", { email: f.email, role: f.role, branch_id: f.branch ? Number(f.branch) : null });
      setF({ email: "", role: "manager", branch: "" });
      changed();
    }, t("portal.team.added"));
  }

  const branchList = branches.status === "success" ? branches.data.data : [];
  const branchName = (id: number | null) => (id === null ? t("portal.team.allBranches") : (branchList.find((b) => b.id === id)?.name ?? t("portal.team.branchN", { id })));

  return (
    <div className="flex flex-col gap-(--space-md)">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-bold text-foreground">{t("portal.nav.team")}</h1>
        <p className="text-sm text-muted-foreground">{t("portal.team.intro")}</p>
      </div>
      {message && (
        <p role="alert" className="text-sm text-destructive">
          {message}
        </p>
      )}

      <Card className="shadow-card ring-0">
        <CardContent className="flex flex-col divide-y divide-border p-0">
          {team.status === "loading" && <p className="p-(--space-sm) text-sm text-muted-foreground">{t("portal.common.loading")}</p>}
          {team.status === "error" && <p className="p-(--space-sm) text-sm text-destructive">{team.error}</p>}
          {team.status === "success" &&
            team.data.data.map((m) => (
              <div key={m.user_id} className="flex flex-wrap items-center justify-between gap-2 p-(--space-sm) text-sm">
                <span className="flex flex-col">
                  <span className="font-medium text-foreground">
                    {m.name ?? m.email ?? m.user_id}
                    {m.user_id === currentUserId ? ` ${t("portal.team.you")}` : ""}
                  </span>
                  <span className="text-muted-foreground">
                    {m.email} · {branchName(m.branch_id)}
                  </span>
                </span>
                <span className="flex items-center gap-2">
                  {m.role === "owner" ? (
                    <span className="rounded-full border border-border px-2.5 py-1 text-xs">{t("portal.team.roleOwner")}</span>
                  ) : (
                    <>
                      <select
                        aria-label={t("portal.team.roleOf", { email: m.email ?? "" })}
                        value={m.role}
                        className={selectClass}
                        onChange={(e) => act(() => send(`/api/provider/team/${m.user_id}`, "PATCH", { role: e.target.value }))}
                      >
                        <option value="manager">{t("portal.team.roleManager")}</option>
                        <option value="agent">{t("portal.team.roleAgent")}</option>
                      </select>
                      <Button type="button" size="icon" variant="ghost" aria-label={t("portal.team.removeMember", { email: m.email ?? "" })} onClick={() => act(() => send(`/api/provider/team/${m.user_id}`, "DELETE"))}>
                        <Trash2 />
                      </Button>
                    </>
                  )}
                </span>
              </div>
            ))}
        </CardContent>
      </Card>

      <Card className="shadow-card ring-0">
        <CardContent className="flex flex-col gap-(--space-sm)">
          <h2 className="font-heading text-lg font-semibold text-foreground">{t("portal.team.addTitle")}</h2>
          <p className="text-sm text-muted-foreground">{t("portal.team.addHelp")}</p>
          <form onSubmit={add} className="grid items-end gap-(--space-sm) sm:grid-cols-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="tm-email">{t("portal.team.email")}</Label>
              <Input id="tm-email" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="tm-role">{t("portal.team.role")}</Label>
              <select id="tm-role" className={selectClass} value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}>
                <option value="manager">{t("portal.team.roleManager")}</option>
                <option value="agent">{t("portal.team.roleAgent")}</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="tm-branch">{t("portal.team.branch")}</Label>
              <select id="tm-branch" className={selectClass} value={f.branch} onChange={(e) => setF({ ...f, branch: e.target.value })}>
                <option value="">{t("portal.team.allBranches")}</option>
                {branchList.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
            <Button type="submit" disabled={save.busy}>
              {t("portal.team.addBtn")}
            </Button>
          </form>
          <Status message={save.message} ok={save.ok} />
        </CardContent>
      </Card>
    </div>
  );
}
