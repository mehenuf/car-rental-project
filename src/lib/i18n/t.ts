import type { Locale } from "./locales";

export type Messages = { [key: string]: string | Messages };
export type Params = Record<string, string | number>;

const PLURAL_CATEGORIES = ["zero", "one", "two", "few", "many", "other"] as const;

function lookup(dict: Messages, key: string): string | Messages | undefined {
  let node: string | Messages | undefined = dict;
  for (const part of key.split(".")) {
    if (typeof node !== "object" || node === null) return undefined;
    node = node[part];
  }
  return node;
}

function isPluralNode(node: Messages): boolean {
  return "other" in node && PLURAL_CATEGORIES.some((c) => typeof node[c] === "string");
}

/** Build a `t(key, params)` for one locale, optionally falling back to another dictionary (English). */
export function createT(locale: Locale, dict: Messages, fallback?: Messages) {
  const rules = new Intl.PluralRules(locale);
  const numbers = new Intl.NumberFormat(locale === "ar" ? "ar-u-nu-latn" : locale);

  function resolve(source: Messages, key: string, params?: Params): string | undefined {
    const node = lookup(source, key);
    if (node === undefined) return undefined;
    let template: string | undefined;
    if (typeof node === "string") {
      template = node;
    } else if (isPluralNode(node) && typeof params?.count === "number") {
      const count = params.count;
      const category = count === 0 && typeof node.zero === "string" ? "zero" : rules.select(count);
      const picked = node[category] ?? node.other;
      template = typeof picked === "string" ? picked : undefined;
    }
    if (template === undefined) return undefined;
    return template.replace(/\{(\w+)\}/g, (whole, name: string) => {
      const value = params?.[name];
      if (value === undefined) return whole;
      return typeof value === "number" ? numbers.format(value) : value;
    });
  }

  return function t(key: string, params?: Params): string {
    return resolve(dict, key, params) ?? (fallback ? resolve(fallback, key, params) : undefined) ?? key;
  };
}

export type TFunction = ReturnType<typeof createT>;
