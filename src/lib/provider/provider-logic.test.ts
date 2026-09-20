import { describe, expect, it } from "vitest";
import { can, canAccessBranch, type ProviderAction } from "@/lib/provider/permissions";
import {
  buildStoragePath,
  canTransitionProvider,
  decisionToStatus,
  missingDocuments,
  missingUnitDocuments,
  validateDocument,
} from "@/lib/provider/onboarding";

describe("permissions", () => {
  const all: ProviderAction[] = [
    "provider.read", "fleet.write", "availability.write", "pricing.write", "bookings.read",
    "bookings.operate", "payouts.read", "team.manage", "documents.write", "payout_account.write",
  ];

  it("gives owners every action", () => {
    for (const action of all) expect(can("owner", action), action).toBe(true);
  });

  it("gives managers everything except team and payout account management", () => {
    for (const action of all) {
      expect(can("manager", action), action).toBe(action !== "team.manage" && action !== "payout_account.write");
    }
  });

  it("limits agents to reading and running bookings", () => {
    const allowed = all.filter((a) => can("agent", a));
    expect(allowed.sort()).toEqual(["bookings.operate", "bookings.read", "provider.read"]);
  });

  it("denies unknown roles", () => {
    expect(can("visitor" as never, "provider.read")).toBe(false);
  });

  it("restricts a branch-scoped member to their branch", () => {
    expect(canAccessBranch({ branchId: null }, 5)).toBe(true);
    expect(canAccessBranch({ branchId: 5 }, 5)).toBe(true);
    expect(canAccessBranch({ branchId: 5 }, 6)).toBe(false);
  });
});

describe("provider status machine", () => {
  it("allows the review flow and resubmission", () => {
    expect(canTransitionProvider("draft", "submitted")).toBe(true);
    expect(canTransitionProvider("submitted", "approved")).toBe(true);
    expect(canTransitionProvider("submitted", "rejected")).toBe(true);
    expect(canTransitionProvider("under_review", "approved")).toBe(true);
    expect(canTransitionProvider("rejected", "submitted")).toBe(true);
    expect(canTransitionProvider("approved", "suspended")).toBe(true);
    expect(canTransitionProvider("suspended", "approved")).toBe(true);
  });

  it("forbids skipping review or approving a draft", () => {
    expect(canTransitionProvider("draft", "approved")).toBe(false);
    expect(canTransitionProvider("rejected", "approved")).toBe(false);
    expect(canTransitionProvider("approved", "draft")).toBe(false);
    expect(canTransitionProvider("approved", "rejected")).toBe(false);
  });

  it("maps admin decisions to statuses and demands a note for reject and suspend", () => {
    expect(decisionToStatus("approve", null)).toBe("approved");
    expect(decisionToStatus("reinstate", null)).toBe("approved");
    expect(decisionToStatus("reject", "Documents are unreadable")).toBe("rejected");
    expect(decisionToStatus("suspend", "Complaints under investigation")).toBe("suspended");
    expect(() => decisionToStatus("reject", "")).toThrow(/reason/i);
    expect(() => decisionToStatus("suspend", null)).toThrow(/reason/i);
  });
});

describe("required documents", () => {
  const doc = (kind: string, status = "pending") => ({ kind, status }) as never;

  it("lists what a company still needs", () => {
    expect(missingDocuments("company", [])).toEqual(["business_licence", "id_document"]);
    expect(missingDocuments("company", [doc("business_licence")])).toEqual(["id_document"]);
    expect(missingDocuments("company", [doc("business_licence"), doc("id_document", "accepted")])).toEqual([]);
  });

  it("lists what an individual still needs", () => {
    expect(missingDocuments("individual", [doc("id_document")])).toEqual(["drivers_licence"]);
  });

  it("ignores rejected documents so the provider must upload a replacement", () => {
    expect(missingDocuments("company", [doc("business_licence", "rejected"), doc("id_document")])).toEqual(["business_licence"]);
  });

  it("requires a registration and insurance document for each private car", () => {
    expect(missingUnitDocuments([])).toEqual(["vehicle_registration", "insurance"]);
    expect(missingUnitDocuments([doc("insurance")])).toEqual(["vehicle_registration"]);
  });
});

describe("document validation and storage paths", () => {
  it("accepts PDF, JPG and PNG up to 5 MB", () => {
    expect(validateDocument({ mimeType: "application/pdf", sizeBytes: 1000 })).toBeNull();
    expect(validateDocument({ mimeType: "image/jpeg", sizeBytes: 5 * 1024 * 1024 })).toBeNull();
    expect(validateDocument({ mimeType: "image/png", sizeBytes: 1 })).toBeNull();
  });

  it("rejects other types, empty files and files over 5 MB", () => {
    expect(validateDocument({ mimeType: "application/x-msdownload", sizeBytes: 10 })).toMatch(/PDF, JPG or PNG/);
    expect(validateDocument({ mimeType: "application/pdf", sizeBytes: 0 })).toMatch(/empty/i);
    expect(validateDocument({ mimeType: "application/pdf", sizeBytes: 5 * 1024 * 1024 + 1 })).toMatch(/5 MB/);
  });

  it("builds a safe path under the provider's folder", () => {
    const path = buildStoragePath("prov-1", "My ID (scan).PDF", "abc123");
    expect(path).toBe("prov-1/abc123-my-id-scan-.pdf");
    expect(buildStoragePath("prov-1", "../../etc/passwd", "x")).not.toContain("..");
    expect(buildStoragePath("prov-1", "../../etc/passwd", "x").startsWith("prov-1/")).toBe(true);
    expect(buildStoragePath("prov-1", "a".repeat(300) + ".png", "x").length).toBeLessThan(120);
  });
});
