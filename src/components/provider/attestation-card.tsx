"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Status, send, useSave } from "@/components/provider/form-utils";
import { useApiData } from "@/hooks/use-api-data";
import { INSURANCE_DECLARATION } from "@/lib/provider/attestation";
import { formatDate } from "@/lib/format";
import { useLocale, useT } from "@/lib/i18n/provider";

/**
 * The versioned insurance declaration a private owner accepts before submitting a car for review. The declaration
 * text itself stays in the wording that was versioned and accepted; only the screen around it is translated.
 */
export function AttestationCard() {
  const t = useT();
  const locale = useLocale();
  const [refresh, setRefresh] = useState(0);
  const [agreed, setAgreed] = useState(false);
  const result = useApiData<{ version: string; acceptedAt: string | null }>(`/api/provider/attestation?_r=${refresh}`);
  const save = useSave();
  if (result.status === "error") return <p role="alert" className="text-sm text-destructive">{result.error}</p>;
  if (result.status !== "success") return null;
  const { version, acceptedAt } = result.data;

  return (
    <Card className="shadow-card ring-0">
      <CardContent className="flex flex-col gap-(--space-xs)">
        <h2 className="font-heading text-base font-semibold text-foreground">{t("portal.attestation.title")}</h2>
        <ul className="list-disc ps-5 text-sm text-muted-foreground" lang="en" dir="ltr">
          {INSURANCE_DECLARATION.map((line) => <li key={line}>{line}</li>)}
        </ul>
        {acceptedAt ? (
          <p className="text-sm text-success-text">{t("portal.attestation.accepted", { date: formatDate(acceptedAt, locale), version })}</p>
        ) : (
          <>
            <label className="flex items-start gap-2 text-sm text-foreground">
              <Checkbox checked={agreed} onCheckedChange={(v) => setAgreed(v === true)} aria-label={t("portal.attestation.acceptAria")} />
              <span>{t("portal.attestation.acceptText")}</span>
            </label>
            <Status message={save.message} ok={save.ok} />
            <Button type="button" size="sm" className="w-fit" disabled={!agreed || save.busy} onClick={() => void save.run(async () => { await send("/api/provider/attestation", "POST", { accepted: true }); setRefresh((n) => n + 1); }, t("portal.attestation.done"))}>
              {t("portal.attestation.accept")}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
