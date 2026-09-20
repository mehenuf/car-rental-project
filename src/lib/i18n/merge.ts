import type { Messages } from "./t";

/** Overlay `override` on `base`, recursively, so a missing translation falls back to English. */
export function deepMerge(base: Messages, override: Messages): Messages {
  const out: Messages = { ...base };
  for (const [key, value] of Object.entries(override)) {
    const existing = out[key];
    out[key] =
      typeof value === "object" && typeof existing === "object"
        ? deepMerge(existing, value)
        : value;
  }
  return out;
}
