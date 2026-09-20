export interface CountryOption {
  code: string;
  name: string;
  currency: string;
  timezone: string;
}

/** Countries a provider can operate in, with the currency and time zone their first branch defaults to. */
export const COUNTRIES: readonly CountryOption[] = [
  { code: "US", name: "United States", currency: "USD", timezone: "America/New_York" },
  { code: "GB", name: "United Kingdom", currency: "GBP", timezone: "Europe/London" },
  { code: "AE", name: "United Arab Emirates", currency: "AED", timezone: "Asia/Dubai" },
  { code: "CA", name: "Canada", currency: "CAD", timezone: "America/Toronto" },
  { code: "AU", name: "Australia", currency: "AUD", timezone: "Australia/Sydney" },
  { code: "NL", name: "Netherlands", currency: "EUR", timezone: "Europe/Amsterdam" },
  { code: "DE", name: "Germany", currency: "EUR", timezone: "Europe/Berlin" },
  { code: "FR", name: "France", currency: "EUR", timezone: "Europe/Paris" },
  { code: "NG", name: "Nigeria", currency: "NGN", timezone: "Africa/Lagos" },
  { code: "KE", name: "Kenya", currency: "KES", timezone: "Africa/Nairobi" },
  { code: "ID", name: "Indonesia", currency: "IDR", timezone: "Asia/Jakarta" },
  { code: "BR", name: "Brazil", currency: "BRL", timezone: "America/Sao_Paulo" },
  { code: "IN", name: "India", currency: "INR", timezone: "Asia/Kolkata" },
  { code: "BD", name: "Bangladesh", currency: "BDT", timezone: "Asia/Dhaka" },
  { code: "JP", name: "Japan", currency: "JPY", timezone: "Asia/Tokyo" },
];
