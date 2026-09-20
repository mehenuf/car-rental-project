import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { LOCALES } from "./locales";
import { deepMerge } from "./merge";
import type { Messages } from "./t";

function load(locale: string): Messages {
  return JSON.parse(readFileSync(join(process.cwd(), "src/messages", `${locale}.json`), "utf8")) as Messages;
}

const PLURAL_KEYS = ["zero", "one", "two", "few", "many", "other"];

/** Plural nodes (only CLDR category keys, with "other") count as one entry, represented by "other": languages differ in how many forms they need. */
function flatten(node: Messages, prefix = ""): Record<string, string> {
  const out: Record<string, string> = {};
  const keys = Object.keys(node);
  if (prefix && "other" in node && keys.every((k) => PLURAL_KEYS.includes(k))) {
    out[prefix] = node.other as string;
    return out;
  }
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

      it("covers every plural form the language needs", () => {
        const needed = new Intl.PluralRules(locale).resolvedOptions().pluralCategories.filter(
          // es, fr and pt only use "many" for very large round numbers; "other" is the fallback.
          (c) => c !== "many" || locale === "ar"
        );
        const walk = (node: Messages, path: string): string[] => {
          const keys = Object.keys(node);
          if (path && "other" in node && keys.every((k) => PLURAL_KEYS.includes(k))) {
            return needed.filter((c) => !(c in node)).map((c) => `${path}.${c}`);
          }
          return Object.entries(node).flatMap(([k, v]) => (typeof v === "object" ? walk(v, path ? `${path}.${k}` : k) : []));
        };
        expect(walk(load(locale), "")).toEqual([]);
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
