import type { ReactNode } from "react";

/** A template (unlike a layout) mounts fresh on every navigation, which lets each page ease in. */
export default function SiteTemplate({ children }: { children: ReactNode }) {
  return <div className="animate-page-in">{children}</div>;
}
