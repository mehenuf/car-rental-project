export type PaymentMethodCode =
  | "card"
  | "paypal"
  | "apple_pay"
  | "google_pay"
  | "ideal"
  | "upi"
  | "bkash"
  | "mpesa";

export interface PaymentMethodInfo {
  code: PaymentMethodCode;
  label: string;
  group: "card" | "wallet" | "bank" | "mobile_money";
  /** Country (ISO 3166-1 alpha-2) and currency a local method is limited to; null means everywhere. */
  country: string | null;
  currency: string | null;
  /** What a tester types into the simulated form to force an outcome. */
  testHint: string;
}

export const PAYMENT_METHODS: readonly PaymentMethodInfo[] = [
  { code: "card", label: "Card", group: "card", country: null, currency: null, testHint: "Any number. Ends 0002 declines, 9995 lacks funds, 3220 asks for a code." },
  { code: "paypal", label: "PayPal", group: "wallet", country: null, currency: null, testHint: 'Type "decline" or "pending" to force an outcome.' },
  { code: "apple_pay", label: "Apple Pay", group: "wallet", country: null, currency: null, testHint: 'Type "decline" or "pending" to force an outcome.' },
  { code: "google_pay", label: "Google Pay", group: "wallet", country: null, currency: null, testHint: 'Type "decline" or "pending" to force an outcome.' },
  { code: "ideal", label: "iDEAL", group: "bank", country: "NL", currency: "EUR", testHint: 'Type "decline" or "pending" to force an outcome.' },
  { code: "upi", label: "UPI", group: "mobile_money", country: "IN", currency: "INR", testHint: 'Type "decline" or "pending" to force an outcome.' },
  { code: "bkash", label: "bKash", group: "mobile_money", country: "BD", currency: "BDT", testHint: 'Type "decline" or "pending" to force an outcome.' },
  { code: "mpesa", label: "M-Pesa", group: "mobile_money", country: "KE", currency: "KES", testHint: 'Type "decline" or "pending" to force an outcome.' },
];

/** Global methods first, then local ones that match the branch country and currency. */
export function methodsFor(country: string, currency: string): PaymentMethodInfo[] {
  return PAYMENT_METHODS.filter(
    (m) => (m.country === null || m.country === country) && (m.currency === null || m.currency === currency)
  );
}

export function isPaymentMethodCode(value: string): value is PaymentMethodCode {
  return PAYMENT_METHODS.some((m) => m.code === value);
}
