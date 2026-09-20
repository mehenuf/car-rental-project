import type { Metadata } from "next";
import { getT } from "@/lib/i18n/dictionary";
import type { ReactNode } from "react";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("meta.register") };
}

export default function RegisterLayout({ children }: { children: ReactNode }) {
  return children;
}
