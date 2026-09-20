import { redirect } from "next/navigation";
import { getLocale } from "@/lib/i18n/dictionary";
import { withLocale } from "@/lib/i18n/negotiate";

/** The old "my bookings" page now lives at /account (which also serves guests from their browser). */
export default async function DashboardPage() {
  redirect(withLocale(await getLocale(), "/account"));
}
