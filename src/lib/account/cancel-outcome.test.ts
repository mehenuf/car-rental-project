import { describe, expect, it } from "vitest";
import { OUTCOME_TTL_MS, cancelOutcomeAgeMs, readCancelOutcome, saveCancelOutcome, type OutcomeStore } from "@/lib/account/cancel-outcome";

function memoryStore(): OutcomeStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
}

describe("cancel outcome", () => {
  it("returns the saved message for the same booking", () => {
    const store = memoryStore();
    saveCancelOutcome(store, "b1", "Cancelled. 40.00 will be refunded.", 1000);
    expect(readCancelOutcome(store, "b1", 2000)).toBe("Cancelled. 40.00 will be refunded.");
  });

  it("does not show one booking's outcome on another", () => {
    const store = memoryStore();
    saveCancelOutcome(store, "b1", "Cancelled.", 1000);
    expect(readCancelOutcome(store, "b2", 1000)).toBeNull();
  });

  it("forgets the message after ten minutes", () => {
    const store = memoryStore();
    saveCancelOutcome(store, "b1", "Cancelled.", 0);
    expect(readCancelOutcome(store, "b1", OUTCOME_TTL_MS)).toBe("Cancelled.");
    expect(readCancelOutcome(store, "b1", OUTCOME_TTL_MS + 1)).toBeNull();
  });

  it("reports how old the outcome is", () => {
    const store = memoryStore();
    expect(cancelOutcomeAgeMs(store, "b1", 5000)).toBeNull();
    saveCancelOutcome(store, "b1", "Cancelled.", 1000);
    expect(cancelOutcomeAgeMs(store, "b1", 4000)).toBe(3000);
  });

  it("copes with missing, blocked or corrupt storage", () => {
    expect(readCancelOutcome(null, "b1")).toBeNull();
    saveCancelOutcome(null, "b1", "x");
    const blocked: OutcomeStore = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("full"); } };
    expect(() => saveCancelOutcome(blocked, "b1", "x")).not.toThrow();
    expect(readCancelOutcome(blocked, "b1")).toBeNull();
    const corrupt = memoryStore();
    corrupt.data.set("bc_cancel_b1", "{not json");
    expect(readCancelOutcome(corrupt, "b1")).toBeNull();
    corrupt.data.set("bc_cancel_b1", JSON.stringify({ message: 5, at: "now" }));
    expect(readCancelOutcome(corrupt, "b1")).toBeNull();
  });
});
