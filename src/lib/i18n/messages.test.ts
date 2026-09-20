import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { LOCALES } from "./locales";
import { deepMerge } from "./merge";
import type { Messages } from "./t";

function load(locale: string): Messages {
  return JSON.parse(readFileSync(join(process.cwd(), "src/messages", `${locale}.json`), "utf8")) as Messages;
}

function flatten(node: Messages, prefix = ""): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(node)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === "string") out[key] = v;
    else Object.assign(out, flatten(v, key));
  }
  return out;
}

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]!).sort();

describe("message catalogues", () => {
  const en = flatten(load("en"));

  for (const locale of LOCALES.filter((l) => l !== "en")) {
    describe(locale, () => {
      const messages = flatten(load(locale));

      it("has exactly the keys English has", () => {
        const missing = Object.keys(en).filter((k) => !(k in messages));
        const extra = Object.keys(messages).filter((k) => !(k in en));
        expect({ missing, extra }).toEqual({ missing: [], extra: [] });
      });

      it("keeps every placeholder", () => {
        for (const [key, value] of Object.entries(messages)) {
          expect(placeholders(value), key).toEqual(placeholders(en[key] ?? ""));
        }
      });

      it("has no empty strings", () => {
        for (const [key, value] of Object.entries(messages)) expect(value.trim(), key).not.toBe("");
      });
    });
  }
});

describe("deepMerge", () => {
  it("overlays nested values and keeps base keys", () => {
    expect(deepMerge({ a: "1", b: { c: "2", d: "3" } }, { b: { c: "x" } })).toEqual({
      a: "1",
      b: { c: "x", d: "3" },
    });
  });
});
