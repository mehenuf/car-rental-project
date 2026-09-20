import { redirect } from "next/navigation";
import { PrivacyPanel } from "@/components/site/privacy-panel";
import { readRequestIdentity } from "@/lib/guest";
import { getLocale, getT } from "@/lib/i18n/dictionary";
import { withLocale } from "@/lib/i18n/negotiate";
import { supabaseAdmin } from "@/lib/supabase-server";

export const metadata = { title: "Privacy" };

export default async function PrivacyPage() {
  const locale = await getLocale();
  const t = await getT();
  const identity = await readRequestIdentity();
  if (!identity.userId || !identity.user?.email) redirect(withLocale(locale, "/login"));

  const { data: accepted } = await supabaseAdmin.from("policy_acceptances").select("kind, version").eq("user_id", identity.userId);

  return (
    <div className="flex flex-col gap-(--space-md)">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-bold text-foreground">{t("privacy.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("privacy.intro")}</p>
      </div>
      <PrivacyPanel email={identity.user.email} accepted={accepted ?? []} />
    </div>
  );
}
