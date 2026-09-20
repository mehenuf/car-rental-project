import { redirect } from "next/navigation";
import { ReviewsManager } from "@/components/provider/reviews-manager";
import { getProviderContext } from "@/lib/provider/context";

export const metadata = { title: "Reviews" };

export default async function ProviderReviewsPage() {
  const active = (await getProviderContext())?.active;
  if (!active) redirect("/provider/apply");
  return <ReviewsManager />;
}
