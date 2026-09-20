/** "Mike Okafor" becomes "Mike O."; a missing or erased name becomes an empty string. */
export function publicReviewer(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0 || /^deleted user$/i.test(fullName.trim())) return "";
  const first = parts[0]!;
  const last = parts.length > 1 ? parts[parts.length - 1]![0]!.toUpperCase() + "." : "";
  return last ? `${first} ${last}` : first;
}

/** Up to `count` items whose text is at most `max` characters, keeping the original order. */
export function shortestFit<T>(items: T[], text: (item: T) => string, count: number, max: number): T[] {
  return items.filter((item) => text(item).trim().length <= max).slice(0, count);
}
