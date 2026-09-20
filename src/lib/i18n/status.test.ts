import { describe, expect, it } from "vitest";
import status from "@/messages/status.json";
import { LOCALES } from "./locales";

// Change a language to "human-reviewed" only after a native speaker has checked it, so the launch checklist stays honest.
describe("translation review status", () => {
  it("records a review state for every language and no others", () => {
    expect(Object.keys(status).sort()).toEqual([...LOCALES].sort());
  });
  it("uses known states", () => {
    for (const v of Object.values(status)) expect(["source", "machine-drafted", "human-reviewed"]).toContain(v);
  });
});
