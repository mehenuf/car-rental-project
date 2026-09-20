/** Slider step for a price range: fine for small prices, coarser as the range grows (300 -> 10, 30,000 -> 1,000). */
export function priceStep(max: number): number {
  if (max <= 100) return 5;
  if (max <= 300) return 10;
  return 10 ** Math.floor(Math.log10(max)) / 10;
}

/** The slider's top end: the dearest daily rate rounded up to a whole step, and never below two steps. */
export function niceMax(highestMajor: number): number {
  const step = priceStep(highestMajor);
  return Math.max(step * 2, Math.ceil(highestMajor / step) * step);
}

export interface PriceScope {
  currency: string;
  /** Slider maximum in major units of `currency`. */
  max: number;
  step: number;
}

export function buildPriceScope(currency: string, highestMinor: number, exponent: number): PriceScope {
  const max = niceMax(highestMinor / 10 ** exponent);
  return { currency, max, step: priceStep(max) };
}
