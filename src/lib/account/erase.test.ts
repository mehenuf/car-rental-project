import { describe, expect, it } from "vitest";
import { eraseConfirmed } from "./erase";

describe("eraseConfirmed", () => {
  it("needs the account email typed exactly, ignoring case and spaces", () => {
    expect(eraseConfirmed("Sam@Example.com ", "sam@example.com")).toBe(true);
    expect(eraseConfirmed("sam@example.com", "sam@example.com")).toBe(true);
  });
  it("refuses anything else", () => {
    expect(eraseConfirmed("", "sam@example.com")).toBe(false);
    expect(eraseConfirmed("DELETE", "sam@example.com")).toBe(false);
    expect(eraseConfirmed("other@example.com", "sam@example.com")).toBe(false);
    expect(eraseConfirmed("sam@example.com", null)).toBe(false);
  });
});
