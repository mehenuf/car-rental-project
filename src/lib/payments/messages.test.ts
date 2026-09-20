import { describe, expect, it } from "vitest";
import { describePaymentFailure } from "@/lib/payments/messages";

describe("describePaymentFailure", () => {
  it("explains known failure codes in plain language", () => {
    expect(describePaymentFailure("card_declined")).toMatch(/declined/i);
    expect(describePaymentFailure("insufficient_funds")).toMatch(/funds/i);
    expect(describePaymentFailure("expired_card")).toMatch(/expired/i);
    expect(describePaymentFailure("authentication_failed")).toMatch(/code/i);
    expect(describePaymentFailure("deposit_declined")).toMatch(/deposit/i);
  });

  it("reassures the customer when the car was lost while paying", () => {
    expect(describePaymentFailure("booking_unavailable")).toMatch(/not been charged|refunded/i);
  });

  it("falls back to a generic message for unknown or missing codes", () => {
    expect(describePaymentFailure("something_new")).toMatch(/could not be completed/i);
    expect(describePaymentFailure(null)).toMatch(/could not be completed/i);
    expect(describePaymentFailure(undefined)).toMatch(/could not be completed/i);
  });
});
