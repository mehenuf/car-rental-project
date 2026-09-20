import { pageMetadata } from "@/lib/seo/metadata";
import dynamic from "next/dynamic";
import { jsonLdString, organizationLd } from "@/lib/seo/jsonld";
import { siteUrl } from "@/lib/seo/urls";
import { HeroSection } from "@/components/site/hero-section";
import { SearchBar } from "@/components/site/search-bar";
import { CarDealsSection } from "@/components/site/car-deals-section";
import { HowItWorksSection } from "@/components/site/how-it-works-section";
import { WhyChooseUsSection } from "@/components/site/why-choose-us-section";
import { Skeleton } from "@/components/ui/skeleton";
import { getVehicleCards } from "@/lib/queries";

const DEALS_PAGE_SIZE = 8;

// Vehicle stock/availability changes at runtime (bookings, admin edits) —
// without this, Next would statically freeze the deals section's data at
// build time, since the homepage otherwise has no per-request dynamic
// input (no searchParams/cookies) to force dynamic rendering on its own.
export const revalidate = 60;
export const generateMetadata = () => pageMetadata("/", {});

// Below the fold on every viewport size — deferred so its JS doesn't
// compete with the hero/search bar/deals for the initial render.
const TestimonialsSection = dynamic(
  () => import("@/components/site/testimonials-section").then((mod) => mod.TestimonialsSection),
  {
    loading: () => (
      <div className="mx-auto max-w-7xl px-(--space-sm) py-(--space-xl)">
        <div className="flex flex-col items-center gap-2">
          <Skeleton className="h-8 w-80 max-w-full" />
          <Skeleton className="h-4 w-64 max-w-full" />
        </div>
        <div className="mt-(--space-lg) grid grid-cols-1 gap-(--space-sm) sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full rounded-xl" />
          ))}
        </div>
      </div>
    ),
  }
);

export default async function HomePage() {
  const { data: deals, count: dealsCount } = await getVehicleCards({
    category: ["popular"],
    page: 1,
    pageSize: DEALS_PAGE_SIZE,
    sortBy: "created_at",
    sortOrder: "desc",
  }).catch((error) => {
    // With no reachable database at build time (CI), build the page without deals; it fills in on the first revalidation.
    // At runtime the error still surfaces, so Next keeps serving the last good page.
    if (process.env.NEXT_PHASE === "phase-production-build") return { data: [], count: 0 };
    throw error;
  });

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(organizationLd(siteUrl())) }} />
      <HeroSection />
      <SearchBar />
      <HowItWorksSection />
      <CarDealsSection initialVehicles={deals} initialCount={dealsCount} />
      <WhyChooseUsSection />
      <TestimonialsSection />
    </>
  );
}
