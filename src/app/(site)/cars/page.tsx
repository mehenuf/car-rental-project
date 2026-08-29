import { Suspense } from "react";
import { CarsPageContent } from "@/components/site/cars-page-content";

export default function CarsPage() {
  return (
    <Suspense fallback={null}>
      <CarsPageContent />
    </Suspense>
  );
}
