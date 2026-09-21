import { describe, expect, it } from "vitest";
import de from "@/messages/de.json";
import en from "@/messages/en.json";
import { createT } from "@/lib/i18n/t";
import { providerNav } from "./provider-nav";

const labels = (type: "company" | "individual", role: "owner" | "manager" | "agent", t: ReturnType<typeof createT>) =>
  providerNav(type, role, t).flatMap((group) => [group.label, ...group.items.map((item) => item.label)]);

describe("providerNav", () => {
  it("has a translation for every label, in every language (no key shows through)", () => {
    for (const [locale, messages] of [["en", en], ["de", de]] as const) {
      const t = createT(locale, messages as never);
      for (const type of ["company", "individual"] as const) {
        for (const role of ["owner", "manager", "agent"] as const) {
          for (const label of labels(type, role, t)) expect(label, `${locale} ${type} ${role}`).not.toMatch(/^portal\./);
        }
      }
    }
  });

  it("uses friendlier names for private owners and the same routes for both", () => {
    const t = createT("en", en as never);
    expect(labels("individual", "owner", t)).toContain("My cars");
    expect(labels("company", "owner", t)).toContain("Fleet");
    expect(labels("individual", "owner", t)).toContain("Earnings");
    const hrefs = (type: "company" | "individual") => providerNav(type, "owner", t).flatMap((g) => g.items.map((i) => i.href));
    expect(hrefs("individual")).toEqual(hrefs("company"));
  });

  it("gives agents a short menu and only owners the team page", () => {
    const t = createT("de", de as never);
    expect(providerNav("company", "agent", t).flatMap((g) => g.items)).toHaveLength(2);
    expect(providerNav("company", "manager", t).flatMap((g) => g.items.map((i) => i.href))).not.toContain("/provider/team");
    expect(providerNav("company", "owner", t).flatMap((g) => g.items.map((i) => i.href))).toContain("/provider/team");
  });
});
