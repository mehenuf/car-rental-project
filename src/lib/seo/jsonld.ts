/** JSON-LD for schema.org; serialised so `<` cannot close the script tag. */
export function jsonLdString(data: Record<string, unknown>): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

export function organizationLd(base: string) {
  return { "@context": "https://schema.org", "@type": "Organization", name: "BestCar", url: base };
}

export function vehicleLd(v: { name: string; brand: string; image_url: string; rating: number; review_count: number }, url: string) {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: v.name,
    brand: { "@type": "Brand", name: v.brand },
    image: v.image_url,
    url,
    ...(v.review_count > 0 ? { aggregateRating: { "@type": "AggregateRating", ratingValue: v.rating, reviewCount: v.review_count } } : {}),
  };
}
