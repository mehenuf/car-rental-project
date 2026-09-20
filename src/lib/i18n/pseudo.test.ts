import { describe, expect, it } from "vitest";
import { pseudoLocalize } from "./pseudo";

describe("pseudoLocalize", () => {
  it("accents letters and lengthens text by roughly 40%", () => {
    const out = pseudoLocalize({ a: "Book now" }).a as string;
    expect(out).not.toContain("Book now");
    expect(out.length).toBeGreaterThanOrEqual(Math.ceil("Book now".length * 1.4));
    expect(out.startsWith("[")).toBe(true);
    expect(out.endsWith("]")).toBe(true);
  });
  it("keeps placeholders intact and recurses", () => {
    const out = pseudoLocalize({ n: { c: "Hi {name}, {count} cars" } }) as { n: { c: string } };
    expect(out.n.c).toContain("{name}");
    expect(out.n.c).toContain("{count}");
  });
});
