import { describe, expect, it } from "vitest";
import { fetchPage, ilikeContains, type PageResult } from "./postgrest";

describe("ilikeContains", () => {
  it("wraps the term in quotes so a comma cannot end the clause", () => {
    expect(ilikeContains("ford, focus")).toBe('"%ford, focus%"');
    expect(ilikeContains("x,stock.eq.0")).toBe('"%x,stock.eq.0%"');
  });

  it("matches wildcards literally by escaping for ILIKE and then for PostgREST", () => {
    expect(ilikeContains("50%_off")).toBe('"%50\\\\%\\\\_off%"');
  });

  it("escapes quotes and backslashes for both layers", () => {
    expect(ilikeContains('a"b')).toBe('"%a\\"b%"');
    expect(ilikeContains("a\\b")).toBe('"%a\\\\\\\\b%"');
  });

  it("leaves plain words alone", () => {
    expect(ilikeContains("civic")).toBe('"%civic%"');
  });
});

describe("fetchPage", () => {
  const ok: PageResult<number> = { data: [1, 2], error: null, count: 24 };

  it("returns the result untouched when the page exists", async () => {
    await expect(fetchPage(async () => ok, 0, 11)).resolves.toEqual(ok);
  });

  it("turns a range past the end into an empty page that keeps the total", async () => {
    const calls: Array<[number, number]> = [];
    const result = await fetchPage(
      async (from, to) => {
        calls.push([from, to]);
        if (from === 0) return { data: [1], error: null, count: 24 };
        return { data: null, error: { code: "PGRST103", message: "Requested range not satisfiable" }, count: null };
      },
      36,
      47
    );
    expect(result).toEqual({ data: [], error: null, count: 24 });
    expect(calls).toEqual([[36, 47], [0, 0]]);
  });

  it("passes other errors through", async () => {
    const failure = { data: null, error: { code: "42P01", message: "boom" }, count: null };
    await expect(fetchPage(async () => failure, 0, 11)).resolves.toEqual(failure);
  });
});
