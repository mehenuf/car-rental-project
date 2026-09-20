import type { ProviderRole } from "@/lib/provider/permissions";

export interface TeamMember {
  userId: string;
  role: ProviderRole;
  branchId: number | null;
}

/** Owners are never added or created here; they come from the application. Returns a message, or null when fine. */
export function validateNewMember(
  members: readonly TeamMember[],
  candidate: TeamMember,
  providerBranchIds: readonly number[]
): string | null {
  if (candidate.role !== "manager" && candidate.role !== "agent") return "New members can be managers or agents, not owners.";
  if (members.some((m) => m.userId === candidate.userId)) return "This person is already on your team.";
  if (candidate.branchId !== null && !providerBranchIds.includes(candidate.branchId)) return "That branch is not one of yours.";
  return null;
}

export function validateRoleChange(members: readonly TeamMember[], userId: string, newRole: ProviderRole): string | null {
  const target = members.find((m) => m.userId === userId);
  if (!target) return "That person is not part of your team.";
  if (target.role === "owner") return "An owner's role cannot be changed.";
  if (newRole !== "manager" && newRole !== "agent") return "Members can be managers or agents, not owners.";
  return null;
}

export function validateRemoval(members: readonly TeamMember[], userId: string, actingUserId: string): string | null {
  const target = members.find((m) => m.userId === userId);
  if (!target) return "That person is not part of your team.";
  if (userId === actingUserId) return "You cannot remove yourself. Ask another owner or contact support to leave.";
  if (target.role === "owner" && members.filter((m) => m.role === "owner").length <= 1) return "An account must keep at least one owner.";
  return null;
}
