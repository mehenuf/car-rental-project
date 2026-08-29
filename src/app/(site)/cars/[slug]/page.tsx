import { notFound } from "next/navigation";
import { Check, Cog, DoorOpen, Fuel as FuelIcon, Star, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { getVehicleBySlug, getVehicles } from "@/lib/queries";
import { Badge } from "@/components/ui/badge";
import { VehicleGallery } from "@/components/site/vehicle-gallery";
import { VehicleBookingPanel } from "@/components/site/vehicle-booking-panel";
import { VehicleCard } from "@/components/site/vehicle-card";

export default async function VehicleDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ pickupDate?: string; dropoffDate?: string }>;
}) {
  const { slug } = await params;
  const { pickupDate, dropoffDate } = await searchParams;

  const vehicle = await getVehicleBySlug(slug);
  if (!vehicle) notFound();

  const { data: sameCategory } = await getVehicles({
    category: [vehicle.category],
    pageSize: 4,
  });
  const similar = sameCategory.filter((v) => v.id !== vehicle.id).slice(0, 3);

  const images = [vehicle.image_url, ...vehicle.gallery.filter((url) => url !== vehicle.image_url)];

  return (
    <div className="mx-auto max-w-7xl px-(--space-sm) py-(--space-lg)">
      <div className="grid grid-cols-1 gap-(--space-lg) lg:grid-cols-[1.6fr_1fr] lg:items-start">
        <div className="flex flex-col gap-(--space-lg)">
          <VehicleGallery images={images} name={vehicle.name} />

          <div className="flex flex-col gap-(--space-sm)">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex flex-col gap-1">
                <Badge variant="outline" className="w-fit capitalize">
                  {vehicle.category}
                </Badge>
                <h1 className="font-heading text-2xl font-bold text-foreground sm:text-3xl">
                  {vehicle.name}
                </h1>
                <p className="text-muted-foreground">{vehicle.brand}</p>
              </div>
              <div className="flex items-center gap-1.5 text-accent">
                <Star className="size-5 fill-current" />
                <span className="font-semibold text-foreground">{vehicle.rating.toFixed(1)}</span>
                <span className="text-sm text-muted-foreground">
                  ({vehicle.review_count} reviews)
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-(--space-sm) rounded-xl border border-border p-(--space-sm) sm:grid-cols-4">
              <Spec icon={Users} label="Seats" value={String(vehicle.seats)} />
              <Spec icon={DoorOpen} label="Doors" value={String(vehicle.doors)} />
              <Spec icon={Cog} label="Transmission" value={vehicle.transmission} />
              <Spec icon={FuelIcon} label="Fuel" value={vehicle.fuel} />
            </div>

            {vehicle.description && (
              <p className="text-muted-foreground">{vehicle.description}</p>
            )}

            {vehicle.features.length > 0 && (
              <div className="flex flex-col gap-2">
                <h2 className="font-heading text-lg font-semibold text-foreground">Features</h2>
                <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {vehicle.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Check className="size-4 shrink-0 text-accent" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        <div className="lg:sticky lg:top-24">
          <VehicleBookingPanel
            vehicle={vehicle}
            defaultPickupDate={pickupDate}
            defaultDropoffDate={dropoffDate}
          />
        </div>
      </div>

      {similar.length > 0 && (
        <div className="mt-(--space-xl) flex flex-col gap-(--space-md)">
          <h2 className="font-heading text-2xl font-bold text-foreground">Similar Vehicles</h2>
          <div className="grid grid-cols-1 gap-(--space-sm) sm:grid-cols-2 lg:grid-cols-3">
            {similar.map((v) => (
              <VehicleCard key={v.id} vehicle={v} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Spec({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="flex flex-col items-center gap-1 text-center">
      <Icon className="size-5 text-accent" />
      <span className="text-sm font-medium text-foreground capitalize">{value}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}
