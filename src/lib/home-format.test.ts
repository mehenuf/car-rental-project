import { describe, expect, it } from "vitest";
import { publicReviewer, shortestFit } from "./home-format";

describe("publicReviewer", () => {
  it("shows a first name and last initial only", () => {
    expect(publicReviewer("Mike Okafor")).toBe("Mike O.");
    expect(publicReviewer("  ana maria  de la Cruz ")).toBe("ana C.");
    expect(publicReviewer("Prince")).toBe("Prince");
  });
  it("shows nothing for an erased account", () => {
    expect(publicReviewer("Deleted user")).toBe("");
    expect(publicReviewer("")).toBe("");
  });
});

describe("shortestFit", () => {
  it("keeps short enough items in order, up to the count", () => {
    const items = ["a".repeat(10), "b".repeat(300), "c".repeat(20), "d".repeat(30)];
    expect(shortestFit(items, (s) => s, 2, 240)).toEqual(["a".repeat(10), "c".repeat(20)]);
  });
});
