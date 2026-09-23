import { redirect } from "next/navigation";
import { getPortalT } from "@/lib/i18n/portal";
import { SettingsPanel } from "@/components/provider/settings-panel";
import { getProviderContext } from "@/lib/provider/context";

export async function generateMetadata() {
  const t = await getPortalT();
  return { title: t("portal.nav.settings") };
}

export default async function ProviderSettingsPage() {
  const active = (await getProviderContext())?.active;
  if (!active) redirect("/provider/apply");
  if (active.role === "agent") redirect("/provider");

  return <SettingsPanel individual={active.provider.type === "individual"} role={active.role} />;
}
