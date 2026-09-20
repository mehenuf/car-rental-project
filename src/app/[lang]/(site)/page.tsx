import { pageMetadata } from "@/lib/seo/metadata";
import { jsonLdString, organizationLd } from "@/lib/seo/jsonld";
import { siteUrl } from "@/lib/seo/urls";
import { HeroSection } from "@/components/site/hero-section";
import { SearchBar } from "@/components/site/search-bar";
import { CarDealsSection } from "@/components/site/car-deals-section";
import { TwoWaysSection } from "@/components/site/two-ways-section";
import { CityShelf } from "@/components/site/city-shelf";
import { TrustSection } from "@/components/site/trust-section";
import { ReviewsSection } from "@/components/site/reviews-section";
import { getCityShelf, getFeaturedReviews, getMarketplaceFacts } from "@/lib/home-data";
import { HowItWorksSection } from "@/components/site/how-it-works-section";
import { getVehicleCards } from "@/lib/queries";

const DEALS_PAGE_SIZE = 8;

// Vehicle stock/availability changes at runtime (bookings, admin edits) —
// without this, Next would statically freeze the deals section's data at
// build time, since the homepage otherwise has no per-request dynamic
// input (no searchParams/cookies) to force dynamic rendering on its own.
export const revalidate = 60;
export const generateMetadata = () => pageMetadata("/", {});

export default async function HomePage() {
  const buildTime = process.env.NEXT_PHASE === "phase-production-build";
  // With no reachable database at build time (CI) the page is built without live content and fills in on the first
  // revalidation. At runtime an error still surfaces, so Next keeps serving the last good page.
  const guard = <T,>(fallback: T) => (error: unknown): T => {
    if (buildTime) return fallback;
    throw error;
  };

  const [{ tiles, hosts }, reviews, { data: deals, count: dealsCount }] = await Promise.all([
    getCityShelf().catch(guard({ tiles: [], hosts: 0 })),
    getFeaturedReviews().catch(guard([])),
    getVehicleCards({ category: ["popular"], page: 1, pageSize: DEALS_PAGE_SIZE, sortBy: "created_at", sortOrder: "desc" }).catch(
      guard({ data: [], count: 0 })
    ),
  ]);
  const facts = await getMarketplaceFacts(tiles.length, hosts).catch(guard({ cars: 0, cities: 0, hosts: 0, showcase: [] }));

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(organizationLd(siteUrl())) }} />
      <HeroSection cityNames={tiles.slice(0, 3).map((tile) => tile.city)} />
      <SearchBar />
      <TwoWaysSection showcase={facts.showcase} />
      <CityShelf tiles={tiles} />
      <CarDealsSection initialVehicles={deals} initialCount={dealsCount} />
      <HowItWorksSection />
      <TrustSection />
      <ReviewsSection reviews={reviews} />
    </>
  );
}
