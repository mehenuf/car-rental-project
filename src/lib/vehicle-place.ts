export interface PlanRow {
  vehicle_id: string;
  branch_id: number;
  currency: string;
  base_daily_minor: number;
}
export interface BranchRow {
  id: number;
  city: string;
}
export interface VehiclePlace {
  /** The branch this place and rate belong to; the booking panel quotes from it so the price shown is the price charged. */
  branchId: number;
  city: string;
  /** How many other cities this car is also offered in. */
  otherCities: number;
  currency: string;
  dailyMinor: number;
}

/**
 * Where and for how much a car is offered, for a card. The price is the daily rate at one branch, in that branch's own
 * currency, so it can be shown next to that branch's city without mixing currencies. When the visitor is looking at
 * a particular branch that one is used; otherwise the lowest branch id, which is stable from one page load to the next.
 */
export function choosePlace(
  plans: PlanRow[],
  branches: BranchRow[],
  preferredBranchId?: number,
): VehiclePlace | null {
  const cityOf = new Map(branches.map((b) => [b.id, b.city]));
  const usable = plans.filter((p) => cityOf.has(p.branch_id));
  if (usable.length === 0) return null;
  const chosen = usable.find((p) => p.branch_id === preferredBranchId) ?? [...usable].sort((a, b) => a.branch_id - b.branch_id)[0]!;
  const city = cityOf.get(chosen.branch_id)!;
  const cities = new Set(usable.map((p) => cityOf.get(p.branch_id)));
  cities.delete(city);
  return { branchId: chosen.branch_id, city, otherCities: cities.size, currency: chosen.currency, dailyMinor: chosen.base_daily_minor };
}

/** True for the placeholder text the sample data uses, which only repeats what the spec strip already shows. */
export function isTemplateDescription(text: string | null | undefined): boolean {
  if (!text || !text.trim()) return true;
  return /^A reliable .{1,60}, well maintained and ready for your next trip\.?$/i.test(text.trim());
}
