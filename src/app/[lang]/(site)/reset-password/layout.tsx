import type { ReactNode } from "react";
import { titleFromKey } from "@/lib/seo/metadata";

export async function generateMetadata() {
  return titleFromKey("meta.resetPassword");
}

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
