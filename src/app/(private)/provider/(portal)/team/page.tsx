import { redirect } from "next/navigation";
import { getPortalT } from "@/lib/i18n/portal";
import { TeamManager } from "@/components/provider/team-manager";
import { getProviderContext } from "@/lib/provider/context";
import { can } from "@/lib/provider/permissions";

export async function generateMetadata() {
  const t = await getPortalT();
  return { title: t("portal.nav.team") };
}

export default async function ProviderTeamPage() {
  const context = await getProviderContext();
  const active = context?.active;
  if (!context || !active) redirect("/provider/apply");
  if (!can(active.role, "team.manage")) redirect("/provider");

  return <TeamManager currentUserId={context.userId} />;
}
