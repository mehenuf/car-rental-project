import type { ReactNode } from "react";
import dynamic from "next/dynamic";
import { SiteHeader } from "@/components/site/site-header";
import { ChatWidget } from "@/components/site/chat-widget";
import { LocationProvider } from "@/components/location/location-provider";
import { Skeleton } from "@/components/ui/skeleton";

// Always below the fold — deferring it keeps its JS off the initial-render
// critical path on every page, not just the homepage.
const SiteFooter = dynamic(
  () => import("@/components/site/site-footer").then((mod) => mod.SiteFooter),
  {
    loading: () => (
      <div className="border-t border-border bg-card">
        <div className="mx-auto max-w-7xl px-(--space-sm) py-(--space-lg)">
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    ),
  }
);

export default function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <LocationProvider>
        <SiteHeader />
        <main id="main-content" className="flex-1">
          {children}
        </main>
        <SiteFooter />
        <ChatWidget />
      </LocationProvider>
    </>
  );
}
