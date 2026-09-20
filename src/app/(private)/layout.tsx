import type { Metadata } from "next";
import { RootShell } from "@/components/root-shell";

// The admin console and provider portal are English-only and never indexed.
export const metadata: Metadata = {
  title: { template: "%s | BestCar", default: "BestCar" },
  robots: { index: false, follow: false },
};

export default function PrivateLayout({ children }: { children: React.ReactNode }) {
  return (
    <RootShell locale="en" skipLabel="Skip to main content">
      {children}
    </RootShell>
  );
}
