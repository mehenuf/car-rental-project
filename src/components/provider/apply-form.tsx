"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Building2, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLocale, useT } from "@/lib/i18n/provider";
import { COUNTRIES } from "@/lib/provider/countries";
import { cn } from "@/lib/utils";

type ProviderType = "company" | "individual";

const TYPES: { value: ProviderType; label: string; description: string; icon: typeof Building2 }[] = [
  { value: "company", label: "portal.apply.company", description: "portal.apply.companyDesc", icon: Building2 },
  { value: "individual", label: "portal.apply.individual", description: "portal.apply.individualDesc", icon: User },
];

/** Step one of becoming a provider: who you are and where your first pick-up location is. */
export function ApplyForm({ defaultName, defaultType = "company" }: { defaultName: string; defaultType?: ProviderType }) {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();
  const [type, setType] = useState<ProviderType>(defaultType);
  const [legalName, setLegalName] = useState(defaultName);
  const [displayName, setDisplayName] = useState(defaultName);
  const [country, setCountry] = useState(COUNTRIES[0]!.code);
  const [phone, setPhone] = useState("");
  const [registration, setRegistration] = useState("");
  const [branchName, setBranchName] = useState("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const selected = COUNTRIES.find((c) => c.code === country) ?? COUNTRIES[0]!;
  // The country's name in the reader's language; the English name is the fallback.
  const countryName = (c: (typeof COUNTRIES)[number]) => {
    try {
      return new Intl.DisplayNames(locale, { type: "region" }).of(c.code) ?? c.name;
    } catch {
      return c.name;
    }
  };

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/provider/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          legal_name: legalName,
          display_name: displayName,
          country_code: country,
          currency: selected.currency,
          contact_phone: phone,
          registration_number: type === "company" && registration.trim() ? registration : null,
          branch: {
            name: branchName || t("portal.apply.defaultBranch", { city }),
            city,
            address,
            timezone: selected.timezone,
          },
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        const issue = body?.error?.issues?.[0];
        throw new Error(issue ? `${issue.path}: ${issue.message}` : (body?.error?.message ?? t("portal.apply.startFailed")));
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("portal.apply.startFailed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-(--space-md)">
      <fieldset className="grid gap-(--space-xs) sm:grid-cols-2">
        <legend className="mb-2 text-sm font-medium text-foreground">{t("portal.apply.iAm")}</legend>
        {TYPES.map((opt) => {
          const Icon = opt.icon;
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={type === opt.value}
              onClick={() => setType(opt.value)}
              className={cn(
                "flex items-start gap-3 rounded-xl border p-(--space-sm) text-start transition-colors",
                type === opt.value ? "border-primary bg-primary/5" : "border-border hover:border-foreground/30"
              )}
            >
              <Icon className="mt-0.5 size-5 shrink-0 text-accent-text" aria-hidden />
              <span className="flex flex-col">
                <span className="font-medium text-foreground">{t(opt.label)}</span>
                <span className="text-sm text-muted-foreground">{t(opt.description)}</span>
              </span>
            </button>
          );
        })}
      </fieldset>

      <div className="grid gap-(--space-sm) sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ap-legal">{type === "company" ? t("portal.apply.legalCompany") : t("portal.apply.legalPerson")}</Label>
          <Input id="ap-legal" value={legalName} onChange={(e) => setLegalName(e.target.value)} required minLength={2} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ap-display">{t("portal.apply.displayName")}</Label>
          <Input id="ap-display" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required minLength={2} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ap-country">{t("portal.apply.country")}</Label>
          <select
            id="ap-country"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className="h-9 rounded-lg border border-input bg-transparent px-2.5 text-sm"
          >
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                {countryName(c)} ({c.currency})
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">{t("portal.apply.pricesIn", { currency: selected.currency })}</p>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ap-phone">{t("portal.apply.phone")}</Label>
          <Input id="ap-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} required minLength={5} />
        </div>
        {type === "company" && (
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="ap-reg">{t("portal.apply.regNumber")}</Label>
            <Input id="ap-reg" value={registration} onChange={(e) => setRegistration(e.target.value)} />
          </div>
        )}
      </div>

      <div className="flex flex-col gap-(--space-sm) border-t border-border pt-(--space-sm)">
        <h2 className="font-heading text-lg font-semibold text-foreground">
          {type === "company" ? t("portal.apply.firstBranch") : t("portal.apply.pickupWhere")}
        </h2>
        <div className="grid gap-(--space-sm) sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ap-city">{t("portal.apply.city")}</Label>
            <Input id="ap-city" value={city} onChange={(e) => setCity(e.target.value)} required minLength={2} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ap-branch">{t("portal.apply.branchOpt")}</Label>
            <Input id="ap-branch" value={branchName} onChange={(e) => setBranchName(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="ap-address">{t("portal.apply.address")}</Label>
            <Input id="ap-address" value={address} onChange={(e) => setAddress(e.target.value)} required minLength={5} />
            <p className="text-xs text-muted-foreground">{t("portal.apply.addressHint")}</p>
          </div>
        </div>
      </div>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" size="lg" disabled={busy} className="self-start">
        {busy ? t("portal.apply.creating") : t("portal.apply.continue")}
      </Button>
    </form>
  );
}
