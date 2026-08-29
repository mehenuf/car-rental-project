import { HeroSection } from "@/components/site/hero-section";
import { SearchBar } from "@/components/site/search-bar";
import { CarDealsSection } from "@/components/site/car-deals-section";
import { HowItWorksSection } from "@/components/site/how-it-works-section";
import { WhyChooseUsSection } from "@/components/site/why-choose-us-section";
import { TestimonialsSection } from "@/components/site/testimonials-section";

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
