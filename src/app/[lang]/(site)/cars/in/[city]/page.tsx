import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { VehicleCard } from "@/components/site/vehicle-card";
import { getT } from "@/lib/i18n/dictionary";
import { getLocations, getVehicleCards } from "@/lib/queries";
import { branchesInCity } from "@/lib/seo/city";
import { pageMetadata } from "@/lib/seo/metadata";

export const revalidate = 300;

async function resolve(city: string) {
  const branches = branchesInCity(await getLocations(), city);
  const first = branches[0];
  return first ? { name: first.city, branches } : null;
}

export async function generateMetadata({ params }: { params: Promise<{ city: string }> }): Promise<Metadata> {
  const { city } = await params;
  const found = await resolve(city);
  if (!found) return {};
  const t = await getT();
  return pageMetadata(`/cars/in/${city}`, {
    title: t("cityPage.title", { city: found.name }),
    description: t("cityPage.intro", { city: found.name }),
  });
}

export default async function CityPage({ params }: { params: Promise<{ city: string }> }) {
  const { city } = await params;
  const found = await resolve(city);
  if (!found) notFound();
  const t = await getT();
  const { name, branches } = found;

  const results = await Promise.all(branches.map((b) => getVehicleCards({ locationId: b.id, available: true, pageSize: 24 })));
  const seen = new Set<string>();
  const vehicles = results.flatMap((r) => r.data).filter((v) => (seen.has(v.id) ? false : (seen.add(v.id), true)));

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-(--space-md) px-(--space-sm) py-(--space-lg)">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground">{t("cityPage.title", { city: name })}</h1>
        <p className="text-muted-foreground">{t("cityPage.intro", { city: name })}</p>
      </div>
      {vehicles.length === 0 ? (
        <p className="text-muted-foreground">{t("cityPage.empty", { city: name })}</p>
      ) : (
        <div className="grid grid-cols-1 gap-(--space-sm) sm:grid-cols-2 xl:grid-cols-3">
          {vehicles.map((v, index) => <VehicleCard key={v.id} vehicle={v} first={index === 0} />)}
        </div>
      )}
    </div>
  );
}
