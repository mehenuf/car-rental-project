import { QuoteError } from "@/lib/pricing/errors";

/** Currencies the engine can price. Only 0 and 2 decimal currencies are
 * supported because `bookings.total_amount` is `numeric(10,2)`; 3-decimal
 * currencies (KWD, BHD, ...) are rejected until that column is widened. */
export const CURRENCY_EXPONENTS: Record<string, 0 | 2> = {
  USD: 2,
  EUR: 2,
  GBP: 2,
  AED: 2,
  CAD: 2,
  AUD: 2,
  NGN: 2,
  KES: 2,
  IDR: 2,
  BRL: 2,
  INR: 2,
  BDT: 2,
  JPY: 0,
};

export function currencyExponent(currency: string): 0 | 2 {
  const exponent = CURRENCY_EXPONENTS[currency];
  if (exponent === undefined) {
    throw new QuoteError("UNSUPPORTED_CURRENCY", `Currency ${currency} is not supported yet.`);
  }
  return exponent;
}

/** `minor` x `bp` / 10000, rounded half away from zero, using integer arithmetic. */
export function mulBp(minor: number, bp: number): number {
  const sign = minor < 0 ? -1 : 1;
  return sign * Math.floor((Math.abs(minor) * bp + 5000) / 10000);
}

export function minorToMajor(minor: number, currency: string): number {
  const exponent = currencyExponent(currency);
  return Number((minor / 10 ** exponent).toFixed(exponent));
}

export function majorToMinor(major: number, currency: string): number {
  return Math.round(major * 10 ** currencyExponent(currency));
}

export function formatMinor(minor: number, currency: string, locale = "en-US"): string {
  const exponent = currencyExponent(currency);
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: exponent,
    maximumFractionDigits: exponent,
  }).format(minor / 10 ** exponent);
}
