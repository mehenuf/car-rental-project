import { redirect } from "next/navigation";
import { PricingManager } from "@/components/provider/pricing-manager";
import { getProviderContext } from "@/lib/provider/context";
import { can } from "@/lib/provider/permissions";

export const metadata = { title: "Pricing" };

export default async function ProviderPricingPage() {
  const active = (await getProviderContext())?.active;
  if (!active) redirect("/provider/apply");
  if (!can(active.role, "pricing.write")) redirect("/provider");

  return <PricingManager individual={active.provider.type === "individual"} />;
}
