import { redirect } from "next/navigation";
import { getPortalT } from "@/lib/i18n/portal";
import { PricingManager } from "@/components/provider/pricing-manager";
import { getProviderContext } from "@/lib/provider/context";
import { can } from "@/lib/provider/permissions";

export async function generateMetadata() {
  const t = await getPortalT();
  return { title: t("portal.nav.pricing") };
}

export default async function ProviderPricingPage() {
  const active = (await getProviderContext())?.active;
  if (!active) redirect("/provider/apply");
  if (!can(active.role, "pricing.write")) redirect("/provider");

  return <PricingManager individual={active.provider.type === "individual"} />;
}
