import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { ApplyForm } from "@/components/provider/apply-form";
import { OnboardingPanel } from "@/components/provider/onboarding-panel";
import { buttonVariants } from "@/components/ui/button";
import { getProviderContext } from "@/lib/provider/context";
import { supabaseAdmin } from "@/lib/supabase-server";

export const metadata: Metadata = { title: "Become a provider" };

export default async function ProviderApplyPage() {
  const context = await getProviderContext();

  if (!context) {
    return (
      <div className="mx-auto flex max-w-lg flex-col gap-(--space-md) px-(--space-sm) py-(--space-2xl) text-center">
        <h1 className="font-heading text-3xl font-bold text-foreground">Rent out your cars on BestCar</h1>
        <p className="text-muted-foreground">Sign in or create a free account, then come back to start your application.</p>
        <div className="flex justify-center gap-(--space-xs)">
          <Link href="/login" className={buttonVariants({ size: "lg" })}>
            Sign in
          </Link>
          <Link href="/register" className={buttonVariants({ variant: "outline", size: "lg" })}>
            Create account
          </Link>
        </div>
      </div>
    );
  }

  const active = context.active;
  if (active?.provider.status === "approved") redirect("/provider");

  let content;
  if (!active) {
    content = <ApplyForm defaultName="" />;
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
