"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Building2, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { COUNTRIES } from "@/lib/provider/countries";
import { cn } from "@/lib/utils";

type ProviderType = "company" | "individual";

const TYPES: { value: ProviderType; label: string; description: string; icon: typeof Building2 }[] = [
  { value: "company", label: "Rental company", description: "A business with a fleet and one or more branches.", icon: Building2 },
  { value: "individual", label: "Private owner", description: "Rent out your own car when it suits you.", icon: User },
];

/** Step one of becoming a provider: who you are and where your first pick-up location is. */
export function ApplyForm({ defaultName, defaultType = "company" }: { defaultName: string; defaultType?: ProviderType }) {
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
            name: branchName || `${city} pick-up`,
            city,
            address,
            timezone: selected.timezone,
          },
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        const issue = body?.error?.issues?.[0];
        throw new Error(issue ? `${issue.path}: ${issue.message}` : (body?.error?.message ?? "Could not start your application."));
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start your application.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-(--space-md)">
      <fieldset className="grid gap-(--space-xs) sm:grid-cols-2">
        <legend className="mb-2 text-sm font-medium text-foreground">I am a</legend>
        {TYPES.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.value}
              type="button"
              role="radio"
              aria-checked={type === t.value}
              onClick={() => setType(t.value)}
              className={cn(
                "flex items-start gap-3 rounded-xl border p-(--space-sm) text-left transition-colors",
                type === t.value ? "border-primary bg-primary/5" : "border-border hover:border-foreground/30"
              )}
            >
              <Icon className="mt-0.5 size-5 shrink-0 text-accent-text" aria-hidden />
              <span className="flex flex-col">
                <span className="font-medium text-foreground">{t.label}</span>
                <span className="text-sm text-muted-foreground">{t.description}</span>
              </span>
            </button>
          );
        })}
      </fieldset>

      <div className="grid gap-(--space-sm) sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ap-legal">{type === "company" ? "Registered company name" : "Full legal name"}</Label>
          <Input id="ap-legal" value={legalName} onChange={(e) => setLegalName(e.target.value)} required minLength={2} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ap-display">Name customers will see</Label>
          <Input id="ap-display" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required minLength={2} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ap-country">Country</Label>
          <select
            id="ap-country"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className="h-9 rounded-lg border border-input bg-transparent px-2.5 text-sm"
          >
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name} ({c.currency})
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">Your prices are set in {selected.currency}.</p>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ap-phone">Contact phone</Label>
          <Input id="ap-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} required minLength={5} />
        </div>
        {type === "company" && (
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="ap-reg">Company registration number</Label>
            <Input id="ap-reg" value={registration} onChange={(e) => setRegistration(e.target.value)} />
          </div>
        )}
      </div>

      <div className="flex flex-col gap-(--space-sm) border-t border-border pt-(--space-sm)">
        <h2 className="font-heading text-lg font-semibold text-foreground">
          {type === "company" ? "First branch" : "Where the car is picked up"}
        </h2>
        <div className="grid gap-(--space-sm) sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ap-city">City</Label>
            <Input id="ap-city" value={city} onChange={(e) => setCity(e.target.value)} required minLength={2} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ap-branch">Branch name (optional)</Label>
            <Input id="ap-branch" value={branchName} onChange={(e) => setBranchName(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="ap-address">Address</Label>
            <Input id="ap-address" value={address} onChange={(e) => setAddress(e.target.value)} required minLength={5} />
            <p className="text-xs text-muted-foreground">
              Customers only see the city. The exact address is shared after a booking is paid.
            </p>
          </div>
        </div>
      </div>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" size="lg" disabled={busy} className="self-start">
        {busy ? "Creating your account..." : "Continue"}
      </Button>
    </form>
  );
}
