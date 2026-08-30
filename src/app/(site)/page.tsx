import dynamic from "next/dynamic";
import { HeroSection } from "@/components/site/hero-section";
import { SearchBar } from "@/components/site/search-bar";
import { CarDealsSection } from "@/components/site/car-deals-section";
import { HowItWorksSection } from "@/components/site/how-it-works-section";
import { WhyChooseUsSection } from "@/components/site/why-choose-us-section";
import { Skeleton } from "@/components/ui/skeleton";

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

export default function HomePage() {
  return (
    <>
      <HeroSection />
      <SearchBar />
      <HowItWorksSection />
      <CarDealsSection />
      <WhyChooseUsSection />
      <TestimonialsSection />
    </>
  );
}
