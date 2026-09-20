/** URL-safe lower-case slug for a city name ("São Paulo" becomes "sao-paulo"). */
export function citySlug(city: string): string {
  return city
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Branch ids for a city slug; empty when no branch is in that city. */
export function branchesInCity<T extends { id: number; city: string }>(branches: T[], slug: string): T[] {
  return branches.filter((b) => citySlug(b.city) === slug);
}
