import { describe, expect, it } from "vitest";
import { validateContact } from "@/lib/booking-form";

describe("validateContact", () => {
  it("accepts a name and an email address", () => {
    expect(validateContact({ name: "Ada Lovelace", email: "ada@example.com" })).toEqual({});
  });

  it("asks for a name when it is empty or only spaces", () => {
    expect(validateContact({ name: "", email: "ada@example.com" })).toEqual({ customer_name: "nameRequired" });
    expect(validateContact({ name: "   ", email: "ada@example.com" })).toEqual({ customer_name: "nameRequired" });
  });

  it("flags an email that cannot be one", () => {
    for (const email of ["", "ada", "ada@", "@example.com", "ada@example", "a da@example.com", "ada@@example.com"]) {
      expect(validateContact({ name: "Ada", email }), email).toEqual({ email: "emailInvalid" });
    }
  });

  it("ignores spaces around the email, as the server does", () => {
    expect(validateContact({ name: "Ada", email: "  ada@example.com " })).toEqual({});
  });

  it("reports both problems together", () => {
    expect(validateContact({ name: "", email: "x" })).toEqual({ customer_name: "nameRequired", email: "emailInvalid" });
  });
});
