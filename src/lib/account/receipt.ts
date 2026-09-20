/** `R-YYYY-000001`: gapless per year; the sequence grows past six digits rather than truncating. */
export function formatReceiptNumber(year: number, sequence: number): string {
  if (!Number.isInteger(sequence) || sequence < 1) throw new Error("Receipt sequence must be a positive integer");
  return `R-${year}-${String(sequence).padStart(6, "0")}`;
}

export function parseReceiptNumber(value: string): { year: number; sequence: number } | null {
  const match = /^R-(\d{4})-(\d{6,})$/.exec(value);
  return match ? { year: Number(match[1]), sequence: Number(match[2]) } : null;
}
