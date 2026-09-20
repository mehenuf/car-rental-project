export interface Place {
  id: number;
  /** Branch name, e.g. "London Victoria". */
  name?: string | null;
  city: string;
  country: string;
  country_code: string;
}

/** Lower case, no accents, single spaces: "São  Paulo" and "sao paulo" compare equal. */
export function normalize(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** How well a place matches a query: higher is better, 0 means no match. */
export function scorePlace(place: Place, query: string): number {
  const q = normalize(query);
  if (!q) return 1;
  const city = normalize(place.city);
  const country = normalize(place.country);
  const name = normalize(place.name ?? "");
  const code = place.country_code.toLowerCase();
  if (city === q) return 100;
  if (city.startsWith(q)) return 90;
  if (city.split(" ").some((w) => w.startsWith(q))) return 80;
  if (name.startsWith(q)) return 70;
  if (city.includes(q)) return 60;
  if (name.includes(q)) return 50;
  if (country.startsWith(q) || code === q) return 40;
  if (country.includes(q)) return 30;
  return 0;
}

/** Matching places, best first, then by city name. An empty query returns everything alphabetically by country. */
export function searchPlaces(places: Place[], query: string, limit = 50): Place[] {
  const scored = places
    .map((place) => ({ place, score: scorePlace(place, query) }))
    .filter((entry) => entry.score > 0);
  scored.sort((a, b) => b.score - a.score || a.place.country.localeCompare(b.place.country) || a.place.city.localeCompare(b.place.city) || (a.place.name ?? "").localeCompare(b.place.name ?? ""));
  return scored.slice(0, limit).map((entry) => entry.place);
}

export interface PlaceGroup {
  country: string;
  country_code: string;
  places: Place[];
}

/** Keeps the order of `places` and gathers them under their country. */
export function groupByCountry(places: Place[]): PlaceGroup[] {
  const groups: PlaceGroup[] = [];
  for (const place of places) {
    let group = groups.find((g) => g.country_code === place.country_code);
    if (!group) {
      group = { country: place.country, country_code: place.country_code, places: [] };
      groups.push(group);
    }
    group.places.push(place);
  }
  return groups;
}

/** The best starting place for a visitor: their city, else their country, else the first place. */
export function pickDefaultPlace(places: Place[], hint: { country?: string | null; city?: string | null }): Place | null {
  if (places.length === 0) return null;
  const country = hint.country?.toLowerCase();
  const inCountry = country ? places.filter((p) => p.country_code.toLowerCase() === country) : [];
  const city = hint.city ? normalize(hint.city) : "";
  const inCity = city ? (inCountry.length > 0 ? inCountry : places).find((p) => normalize(p.city) === city) : undefined;
  return inCity ?? inCountry[0] ?? places[0] ?? null;
}

/** "London Victoria, London" or just "London" when the branch name adds nothing. */
export function placeLabel(place: Place): string {
  const name = place.name?.trim();
  if (name && normalize(name) !== normalize(place.city) && !normalize(name).startsWith(normalize(place.city))) return `${name}, ${place.city}`;
  return name && normalize(name) !== normalize(place.city) ? name : place.city;
}

/** Splits text into parts so the matching part can be highlighted. */
export function highlightParts(text: string, query: string): { text: string; match: boolean }[] {
  const q = normalize(query);
  if (!q) return [{ text, match: false }];
  const plain = normalize(text);
  // Accent-stripping can change length only for exotic input; fall back to no highlight then.
  if (plain.length !== text.length) return [{ text, match: false }];
  const index = plain.indexOf(q);
  if (index < 0) return [{ text, match: false }];
  return [
    { text: text.slice(0, index), match: false },
    { text: text.slice(index, index + q.length), match: true },
    { text: text.slice(index + q.length), match: false },
  ].filter((part) => part.text.length > 0);
}
