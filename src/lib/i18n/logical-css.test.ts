import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Translated areas must use logical utilities (ms-, ps-, text-start, start-) so Arabic mirrors
 * correctly. This fails on a new physical one; the private portals are English-only and exempt.
 */
const ROOTS = ["src/app/[lang]", "src/components/site", "src/components/root-shell.tsx"];

const PHYSICAL_UTILITY =
  /(?:^|[\s"'`])(?:[a-z0-9-]+:)*-?(?:ml|mr|pl|pr|left|right|text-left|text-right|rounded-l|rounded-r|rounded-tl|rounded-tr|rounded-bl|rounded-br|border-l|border-r|scroll-ml|scroll-mr)(?:-[a-z0-9./()[\]-]+)?(?=[\s"'`]|$)/;

/** Only look inside string literals that sit on a className line, not comments or prose. */
function classStrings(line: string): string[] {
  if (/^\s*(\/\/|\*|\/\*)/.test(line)) return [];
  if (line.includes("side=")) return []; // Sheet `side` is a prop value, chosen per direction
  if (!/className|cn\(|clsx|cva|variants/.test(line) && !/^\s*["'`][^"'`]*["'`],?\s*$/.test(line)) return [];
  return [...line.matchAll(/["'`]([^"'`]*)["'`]/g)].map((m) => m[1] ?? "");
}

function files(path: string): string[] {
  if (statSync(path).isFile()) return path.endsWith(".tsx") ? [path] : [];
  return readdirSync(path).flatMap((name) => files(join(path, name)));
}

describe("logical CSS in translated areas", () => {
  for (const file of ROOTS.flatMap((r) => files(join(process.cwd(), r)))) {
    it(relative(process.cwd(), file), () => {
      const offenders = readFileSync(file, "utf8")
        .split("\n")
        .flatMap((text, i) =>
          classStrings(text)
            .filter((s) => PHYSICAL_UTILITY.test(` ${s} `))
            .map((s) => `${i + 1}: ${s.slice(0, 100)}`)
        );
      expect(offenders).toEqual([]);
    });
  }
});
