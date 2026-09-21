import { redirect } from "next/navigation";
import { getPortalT } from "@/lib/i18n/portal";
import { PayoutsView } from "@/components/provider/payouts-view";
import { getProviderContext } from "@/lib/provider/context";
import { can } from "@/lib/provider/permissions";

export async function generateMetadata() {
  const t = await getPortalT();
  return { title: t("portal.nav.payouts") };
}

export default async function ProviderPayoutsPage() {
  const active = (await getProviderContext())?.active;
  if (!active) redirect("/provider/apply");
  if (!can(active.role, "payouts.read")) redirect("/provider");

  return <PayoutsView individual={active.provider.type === "individual"} />;
}
