/**
 * Helpers for building PostgREST filter strings and paging safely.
 */

/**
 * The value half of a PostgREST `.or()` clause such as `name.ilike.<value>`, matching `term` anywhere in the column.
 *
 * The term is wrapped in double quotes, so `,` `.` `:` `(` `)` inside it can neither end the clause nor start a new
 * one (`x,stock.eq.0` stays one search word). Inside the quotes PostgREST treats `\` and `"` as escapes, and ILIKE
 * treats `%`, `_` and `\` as wildcards or escapes, so both layers are escaped and the visitor's text is matched literally.
 */
export function ilikeContains(term: string): string {
  const pattern = term.replace(/[\\%_]/g, (c) => `\\${c}`);
  const quoted = pattern.replace(/[\\"]/g, (c) => `\\${c}`);
  return `"%${quoted}%"`;
}

export interface PageResult<T> {
  data: T[] | null;
  error: { code?: string; message: string } | null;
  count: number | null;
}

/**
 * Runs a ranged query. PostgREST answers a page that starts past the last row with error PGRST103 (HTTP 416), which
 * used to surface as a crash for a URL like `?page=99`. That is turned into an empty page that still carries the true
 * total, so callers can show the last page instead.
 */
export async function fetchPage<T>(
  run: (from: number, to: number) => PromiseLike<PageResult<T>>,
  from: number,
  to: number
): Promise<PageResult<T>> {
  const result = await run(from, to);
  if (result.error?.code !== "PGRST103") return result;
  const head = await run(0, 0);
  return { data: [], error: head.error, count: head.count };
}
