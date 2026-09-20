import { redirect } from "next/navigation";
import { SettingsPanel } from "@/components/provider/settings-panel";
import { getProviderContext } from "@/lib/provider/context";

export const metadata = { title: "Settings" };

export default async function ProviderSettingsPage() {
  const active = (await getProviderContext())?.active;
  if (!active) redirect("/provider/apply");
  if (active.role === "agent") redirect("/provider");

  return <SettingsPanel individual={active.provider.type === "individual"} role={active.role} />;
}
