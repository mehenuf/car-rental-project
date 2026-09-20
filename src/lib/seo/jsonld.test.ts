import { describe, expect, it } from "vitest";
import { jsonLdString, organizationLd, vehicleLd } from "./jsonld";

describe("json-ld", () => {
  it("escapes angle brackets", () => {
    expect(jsonLdString({ a: "</script>" })).not.toContain("<");
  });
  it("omits ratings when there are no reviews", () => {
    const v = { name: "A", brand: "B", image_url: "i", rating: 0, review_count: 0 };
    expect(vehicleLd(v, "u")).not.toHaveProperty("aggregateRating");
    expect(vehicleLd({ ...v, rating: 4.5, review_count: 2 }, "u")).toHaveProperty("aggregateRating");
  });
});

describe("organizationLd", () => {
  it("names the site", () => {
    expect(organizationLd("https://x.test")).toMatchObject({ "@type": "Organization", url: "https://x.test" });
  });
});
