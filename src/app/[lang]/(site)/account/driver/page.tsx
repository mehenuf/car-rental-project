import { titleFromKey } from "@/lib/seo/metadata";
import { redirect } from "next/navigation";
import { DriverForm } from "@/components/site/driver-form";
import { readRequestIdentity } from "@/lib/guest";
import { getLocale, getT } from "@/lib/i18n/dictionary";
import { withLocale } from "@/lib/i18n/negotiate";
import { supabaseAdmin } from "@/lib/supabase-server";

export async function generateMetadata() {
  return titleFromKey("meta.accountDriver");
}

export default async function DriverPage() {
  const locale = await getLocale();
  const t = await getT();
  const identity = await readRequestIdentity();
  if (!identity.userId) redirect(withLocale(locale, "/login?next=" + encodeURIComponent("/account/driver")));

  const [{ data: profile }, { data: documents }] = await Promise.all([
    supabaseAdmin.from("driver_profiles").select("*").eq("user_id", identity.userId).maybeSingle(),
    supabaseAdmin.from("driver_documents").select("kind").eq("user_id", identity.userId),
  ]);

  return (
    <div className="flex flex-col gap-(--space-md)">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-bold text-foreground">{t("driver.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("driver.intro")}</p>
      </div>
      <DriverForm
        status={profile?.status ?? "unverified"}
        reviewNote={profile?.review_note ?? null}
        uploaded={(documents ?? []).map((d) => d.kind)}
        defaults={{
          date_of_birth: profile?.date_of_birth ?? "",
          licence_country: profile?.licence_country ?? "",
          licence_number_last4: profile?.licence_number_last4 ?? "",
          licence_expiry: profile?.licence_expiry ?? "",
        }}
      />
    </div>
  );
}
