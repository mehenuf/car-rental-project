import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarClock, Car, Gauge, Wallet } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate } from "@/lib/format";
import { formatMinor } from "@/lib/pricing/money";
import { numberingLocale } from "@/lib/i18n/locales";
import { getPortalLocale, getPortalT } from "@/lib/i18n/portal";
import { getProviderContext } from "@/lib/provider/context";
import { summarizeBookings, utilisationPercent, type OverviewBooking } from "@/lib/provider/overview";
import { supabaseAdmin } from "@/lib/supabase-server";

export async function generateMetadata() {
  const t = await getPortalT();
  return { title: t("portal.nav.overview") };
}

const DAY = 86_400_000;

export default async function ProviderOverviewPage() {
  const locale = await getPortalLocale();
  const t = await getPortalT();
  const context = await getProviderContext();
  const active = context?.active;
  if (!active) redirect("/provider/apply");
  const providerId = active.providerId;

  const now = new Date();
  const windowEnd = new Date(now.getTime() + 30 * DAY);

  const [units, branch, bookings, occupancy] = await Promise.all([
    supabaseAdmin.from("fleet_units").select("id, branch_id", { count: "exact" }).eq("provider_id", providerId).eq("status", "active").eq("listing_status", "approved"),
    supabaseAdmin.from("branches").select("timezone").eq("provider_id", providerId).order("id", { ascending: true }).limit(1).maybeSingle(),
    supabaseAdmin
      .from("bookings")
      .select("id, reference, status, payment_status, created_at, pickup_at, dropoff_at, customer_name, price_snapshot")
      .eq("provider_id", providerId)
      .gte("created_at", new Date(now.getTime() - 62 * DAY).toISOString())
      .order("created_at", { ascending: false })
      .limit(500),
    supabaseAdmin
      .from("unit_occupancy")
      .select("during, reason")
      .eq("provider_id", providerId)
      .eq("reason", "booking")
      .overlaps("during", `[${now.toISOString()},${windowEnd.toISOString()})`),
  ]);

  const timezone = branch.data?.timezone ?? "UTC";
  const rows: OverviewBooking[] = (bookings.data ?? []).map((b) => ({
    status: b.status,
    payment_status: b.payment_status,
    created_at: b.created_at ?? now.toISOString(),
    pickup_at: b.pickup_at,
    dropoff_at: b.dropoff_at,
    providerPayoutMinor: Number((b.price_snapshot as { quote?: { providerPayoutMinor?: number } } | null)?.quote?.providerPayoutMinor ?? 0),
  }));
  const summary = summarizeBookings(rows, now, timezone);

  // Booked time inside the next 30 days, clipped to the window.
  let occupiedMs = 0;
  for (const o of occupancy.data ?? []) {
    const [rawStart = "", rawEnd = ""] = o.during.slice(1, -1).split(",");
    const parse = (s: string) => new Date(s.replace(/"/g, "").trim().replace(" ", "T").replace(/([+-]\d{2})$/, "$1:00")).getTime();
    occupiedMs += Math.max(0, Math.min(parse(rawEnd), windowEnd.getTime()) - Math.max(parse(rawStart), now.getTime()));
  }
  const utilisation = utilisationPercent(occupiedMs, units.count ?? 0, 30 * DAY);
  const currency = active.provider.defaultCurrency;
  const money = (minor: number) => formatMinor(minor, currency, numberingLocale(locale));

  const stats = [
    { label: t("portal.overview.earnings"), value: money(summary.earningsThisMonthMinor), icon: Wallet },
    { label: t("portal.overview.bookings"), value: String(summary.bookingsThisMonth), icon: Car },
    { label: t("portal.overview.movements"), value: `${summary.pickupsToday} / ${summary.returnsToday}`, icon: CalendarClock },
    { label: t("portal.overview.utilisation"), value: `${utilisation}%`, icon: Gauge },
  ];

  return (
    <div className="flex flex-col gap-(--space-md)">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-bold text-foreground">{active.provider.displayName}</h1>
        <p className="text-sm text-muted-foreground">
          {t("portal.overview.summary", { count: units.count ?? 0, timezone })}
        </p>
      </div>

      <div className="grid gap-(--space-sm) sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <Card key={s.label} className="shadow-card ring-0">
              <CardContent className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-lg bg-accent/10 text-accent-text">
                  <Icon className="size-5" aria-hidden />
                </span>
                <div className="flex flex-col">
                  <span className="text-sm text-muted-foreground">{s.label}</span>
                  <span className="font-heading text-xl font-bold text-foreground">{s.value}</span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {(units.count ?? 0) === 0 && (
        <Card className="shadow-card ring-0">
          <CardContent className="flex flex-col items-start gap-2">
            <p className="text-foreground">{t("portal.overview.noCars")}</p>
            <Link href="/provider/fleet" className={buttonVariants()}>
              {t("portal.overview.addFirst")}
            </Link>
          </CardContent>
        </Card>
      )}

      <Card className="shadow-card ring-0">
        <CardContent className="flex flex-col gap-2">
          <h2 className="font-heading text-lg font-semibold text-foreground">{t("portal.overview.recent")}</h2>
          {(bookings.data ?? []).length === 0 && <p className="text-sm text-muted-foreground">{t("portal.overview.noBookings")}</p>}
          <ul className="flex flex-col divide-y divide-border text-sm">
            {(bookings.data ?? []).slice(0, 6).map((b) => (
              <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span className="font-medium text-foreground">
                  {b.reference} <span className="font-normal text-muted-foreground">{b.customer_name}</span>
                </span>
                <span className="text-muted-foreground">
                  {t("portal.overview.range", { from: formatDate(b.pickup_at, locale), to: formatDate(b.dropoff_at, locale) })} · {t(`portal.status.${b.status}`)} · {t(`portal.payment.${b.payment_status}`)}
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
