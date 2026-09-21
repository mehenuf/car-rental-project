import { redirect } from "next/navigation";
import { getPortalT } from "@/lib/i18n/portal";
import { FleetManager } from "@/components/provider/fleet-manager";
import { getProviderContext } from "@/lib/provider/context";
import { can } from "@/lib/provider/permissions";

export async function generateMetadata() {
  const t = await getPortalT();
  return { title: t("portal.nav.fleet") };
}

export default async function ProviderFleetPage() {
  const active = (await getProviderContext())?.active;
  if (!active) redirect("/provider/apply");
  if (!can(active.role, "provider.read") || active.role === "agent") redirect("/provider");

  return <FleetManager individual={active.provider.type === "individual"} canWrite={can(active.role, "fleet.write")} />;
}
