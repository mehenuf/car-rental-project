import { redirect } from "next/navigation";
import { getPortalT } from "@/lib/i18n/portal";
import { DisputesManager } from "@/components/provider/disputes-manager";
import { getProviderContext } from "@/lib/provider/context";

export async function generateMetadata() {
  const t = await getPortalT();
  return { title: t("portal.nav.disputes") };
}

export default async function ProviderDisputesPage() {
  const active = (await getProviderContext())?.active;
  if (!active) redirect("/provider/apply");
  return <DisputesManager />;
}
