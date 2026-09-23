import { redirect } from "next/navigation";
import { getPortalT } from "@/lib/i18n/portal";
import { ReviewsManager } from "@/components/provider/reviews-manager";
import { getProviderContext } from "@/lib/provider/context";

export async function generateMetadata() {
  const t = await getPortalT();
  return { title: t("portal.nav.reviews") };
}

export default async function ProviderReviewsPage() {
  const active = (await getProviderContext())?.active;
  if (!active) redirect("/provider/apply");
  return <ReviewsManager />;
}
