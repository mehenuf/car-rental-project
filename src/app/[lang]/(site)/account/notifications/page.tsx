import { redirect } from "next/navigation";
import { NotificationSettings } from "@/components/site/notification-settings";
import { readRequestIdentity } from "@/lib/guest";
import { getLocale, getT } from "@/lib/i18n/dictionary";
import { withLocale } from "@/lib/i18n/negotiate";

export const metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const locale = await getLocale();
  const t = await getT();
  const identity = await readRequestIdentity();
  if (!identity.userId) redirect(withLocale(locale, "/login"));

  return (
    <div className="flex flex-col gap-(--space-md)">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-bold text-foreground">{t("notify.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("notify.intro")}</p>
      </div>
      <NotificationSettings />
    </div>
  );
}
