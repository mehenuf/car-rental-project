/** One CSV cell. Quotes when needed and defuses spreadsheet formulas (a leading = + - @ or tab). */
export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  let text = value instanceof Date ? value.toISOString() : typeof value === "object" ? JSON.stringify(value) : String(value);
  if (typeof value === "string" && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function csvRow(values: unknown[]): string {
  return values.map(csvCell).join(",");
}

/** Streams a header and rows as CSV chunks, so a large export never sits in memory. */
export async function* csvStream<T extends Record<string, unknown>>(rows: AsyncIterable<T>, columns: (keyof T & string)[]): AsyncGenerator<string> {
  yield csvRow(columns) + "\r\n";
  for await (const row of rows) yield csvRow(columns.map((c) => row[c])) + "\r\n";
}
