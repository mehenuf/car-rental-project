import { redirect } from "next/navigation";
import { CalendarView } from "@/components/provider/calendar-view";
import { getProviderContext } from "@/lib/provider/context";
import { can } from "@/lib/provider/permissions";

export const metadata = { title: "Calendar" };

export default async function ProviderCalendarPage() {
  const active = (await getProviderContext())?.active;
  if (!active) redirect("/provider/apply");
  if (active.role === "agent") redirect("/provider");

  return <CalendarView individual={active.provider.type === "individual"} canWrite={can(active.role, "availability.write")} />;
}
