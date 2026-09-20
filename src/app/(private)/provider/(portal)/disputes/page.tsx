import { redirect } from "next/navigation";
import { DisputesManager } from "@/components/provider/disputes-manager";
import { getProviderContext } from "@/lib/provider/context";

export const metadata = { title: "Disputes" };

export default async function ProviderDisputesPage() {
  const active = (await getProviderContext())?.active;
  if (!active) redirect("/provider/apply");
  return <DisputesManager />;
}
