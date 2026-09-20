import { redirect } from "next/navigation";
import { BookingsManager } from "@/components/provider/bookings-manager";
import { getProviderContext } from "@/lib/provider/context";
import { can } from "@/lib/provider/permissions";

export const metadata = { title: "Bookings" };

export default async function ProviderBookingsPage() {
  const active = (await getProviderContext())?.active;
  if (!active) redirect("/provider/apply");
  if (!can(active.role, "bookings.read")) redirect("/provider");

  return <BookingsManager canOperate={can(active.role, "bookings.operate")} canCancel={can(active.role, "bookings.cancel")} />;
}
