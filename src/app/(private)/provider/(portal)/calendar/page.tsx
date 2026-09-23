import { redirect } from "next/navigation";
import { getPortalT } from "@/lib/i18n/portal";
import { CalendarView } from "@/components/provider/calendar-view";
import { getProviderContext } from "@/lib/provider/context";
import { can } from "@/lib/provider/permissions";

export async function generateMetadata() {
  const t = await getPortalT();
  return { title: t("portal.nav.calendar") };
}

export default async function ProviderCalendarPage() {
  const active = (await getProviderContext())?.active;
  if (!active) redirect("/provider/apply");
  if (active.role === "agent") redirect("/provider");

  return <CalendarView individual={active.provider.type === "individual"} canWrite={can(active.role, "availability.write")} />;
}
