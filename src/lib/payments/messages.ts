const MESSAGES: Record<string, string> = {
  card_declined: "Your card was declined. Please try a different card or payment method.",
  insufficient_funds: "There are not enough funds on this card. Please try another payment method.",
  expired_card: "This card has expired. Please use a different card.",
  authentication_failed: "The confirmation code was not accepted. Please check the code and try again.",
  declined_by_provider: "The payment provider declined this payment. Please try another method.",
  deposit_declined:
    "We could not place the refundable security deposit hold, so you have not been charged. Please try another payment method.",
  booking_unavailable:
    "This car was booked by someone else while you were paying. You have not been charged, and any payment was refunded.",
  refund_failed: "The refund could not be processed automatically. Our team will follow up.",
};

/** Plain-language text for a payment failure code, safe to show to a customer. */
export function describePaymentFailure(code: string | null | undefined): string {
  return (code && MESSAGES[code]) || "Your payment could not be completed. Please try again or use another method.";
}
