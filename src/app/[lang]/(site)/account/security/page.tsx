import { MfaSetup } from "@/components/site/mfa-setup";
import { getT } from "@/lib/i18n/dictionary";

export const metadata = { title: "Security" };

export default async function SecurityPage() {
  const t = await getT();
  return (
    <div className="flex flex-col gap-(--space-md)">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-bold text-foreground">{t("security.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("security.intro")}</p>
      </div>
      <MfaSetup />
    </div>
  );
}
