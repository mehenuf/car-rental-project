import { titleFromKey } from "@/lib/seo/metadata";
import { Link } from "@/lib/i18n/link";
import { redirect } from "next/navigation";
import { ApplyForm } from "@/components/provider/apply-form";
import { OnboardingPanel } from "@/components/provider/onboarding-panel";
import { buttonVariants } from "@/components/ui/button";
import { getT } from "@/lib/i18n/dictionary";
import { getProviderContext } from "@/lib/provider/context";
import { supabaseAdmin } from "@/lib/supabase-server";

export async function generateMetadata() {
  return titleFromKey("meta.providerApply");
}

export default async function ProviderApplyPage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const { type } = await searchParams;
  const defaultType = type === "individual" ? "individual" : "company";
  const context = await getProviderContext();

  if (!context) {
    // The front door for new hosts is translated; the application and the portal behind it are English only for now.
    const t = await getT();
    return (
      <div className="mx-auto flex max-w-lg flex-col gap-(--space-md) px-(--space-sm) py-(--space-2xl) text-center">
        <h1 className="font-heading text-3xl font-bold text-foreground">{t("providerApply.title")}</h1>
        <p className="text-muted-foreground">{t("providerApply.body")}</p>
        <div className="flex justify-center gap-(--space-xs)">
          <Link href="/login?next=%2Fprovider%2Fapply" className={buttonVariants({ size: "lg" })}>
            {t("header.logIn")}
          </Link>
          <Link href="/register" className={buttonVariants({ variant: "outline", size: "lg" })}>
            {t("header.register")}
          </Link>
        </div>
      </div>
    );
  }

  const active = context.active;
  if (active?.provider.status === "approved") redirect("/provider");

  let content;
  if (!active) {
    content = <ApplyForm defaultName="" defaultType={defaultType} />;
  } else {
    const [{ data: documents }, { data: provider }] = await Promise.all([
      supabaseAdmin
        .from("provider_documents")
        .select("id, kind, file_name, status, review_note, created_at")
        .eq("provider_id", active.providerId)
        .is("fleet_unit_id", null)
        .order("created_at", { ascending: true }),
      supabaseAdmin.from("providers").select("review_note").eq("id", active.providerId).maybeSingle(),
    ]);
    content = (
      <OnboardingPanel
        type={active.provider.type}
        status={active.provider.status}
        reviewNote={provider?.review_note ?? null}
        documents={documents ?? []}
      />
    );
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-(--space-md) px-(--space-sm) py-(--space-xl)">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground">
          {active ? `Your application: ${active.provider.displayName}` : "Become a provider"}
        </h1>
        <p className="text-muted-foreground">
          {active
            ? "Finish these steps and our team will review your account."
            : "Tell us about your business or your car. You can add your fleet once you are approved."}
        </p>
      </div>
      {content}
    </div>
  );
}
