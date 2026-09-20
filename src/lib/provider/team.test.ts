import { describe, expect, it } from "vitest";
import { can } from "@/lib/provider/permissions";
import { validateNewMember, validateRemoval, validateRoleChange, type TeamMember } from "@/lib/provider/team";

const owner: TeamMember = { userId: "u-owner", role: "owner", branchId: null };
const manager: TeamMember = { userId: "u-mgr", role: "manager", branchId: null };
const agent: TeamMember = { userId: "u-agent", role: "agent", branchId: 3 };

describe("bookings.cancel permission", () => {
  it("lets owners and managers cancel a booking but not agents", () => {
    expect(can("owner", "bookings.cancel")).toBe(true);
    expect(can("manager", "bookings.cancel")).toBe(true);
    expect(can("agent", "bookings.cancel")).toBe(false);
  });
});

describe("validateNewMember", () => {
  it("accepts a new manager or agent", () => {
    expect(validateNewMember([owner], { userId: "u-new", role: "manager", branchId: null }, [1, 2])).toBeNull();
    expect(validateNewMember([owner], { userId: "u-new", role: "agent", branchId: 2 }, [1, 2])).toBeNull();
  });

  it("rejects duplicates, owners and branches that are not the provider's", () => {
    expect(validateNewMember([owner], { userId: "u-owner", role: "manager", branchId: null }, [1])).toMatch(/already/i);
    expect(validateNewMember([owner], { userId: "u-new", role: "owner" as never, branchId: null }, [1])).toMatch(/owner/i);
    expect(validateNewMember([owner], { userId: "u-new", role: "agent", branchId: 99 }, [1, 2])).toMatch(/branch/i);
  });
});

describe("validateRoleChange", () => {
  it("allows switching between manager and agent", () => {
    expect(validateRoleChange([owner, manager], "u-mgr", "agent")).toBeNull();
  });

  it("never changes an owner's role or promotes to owner", () => {
    expect(validateRoleChange([owner, manager], "u-owner", "agent")).toMatch(/owner/i);
    expect(validateRoleChange([owner, manager], "u-mgr", "owner" as never)).toMatch(/owner/i);
    expect(validateRoleChange([owner], "someone-else", "agent")).toMatch(/not part/i);
  });
});

describe("validateRemoval", () => {
  it("lets an owner remove a manager or agent", () => {
    expect(validateRemoval([owner, manager, agent], "u-agent", "u-owner")).toBeNull();
  });

  it("never removes the last owner or the caller themselves", () => {
    expect(validateRemoval([owner, manager], "u-owner", "u-mgr")).toMatch(/owner/i);
    expect(validateRemoval([owner, manager], "u-mgr", "u-mgr")).toMatch(/yourself|leave/i);
    expect(validateRemoval([owner], "nobody", "u-owner")).toMatch(/not part/i);
  });
});
