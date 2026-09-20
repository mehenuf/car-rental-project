import type { KeyboardEvent } from "react";

const TABBABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type=hidden])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

/**
 * Where focus should go when Tab or Shift+Tab is pressed inside a modal, or null to let the browser move it. Wraps
 * from the last control to the first and back, so focus can never leave the dialog.
 */
export function nextTrapTarget<T>(items: T[], active: T | null, shift: boolean, container: T | null = null): T | null {
  if (items.length === 0) return null;
  const first = items[0]!;
  const last = items[items.length - 1]!;
  if (shift) return active === first || active === container || active === null ? last : null;
  return active === last ? first : null;
}

/** onKeyDown for a modal's popup: keeps Tab inside it however the dialog was opened (keyboard, mouse or touch). */
export function trapTab(event: KeyboardEvent<HTMLElement>): void {
  if (event.key !== "Tab") return;
  const root = event.currentTarget;
  const items = [...root.querySelectorAll<HTMLElement>(TABBABLE)].filter((el) => el.getClientRects().length > 0);
  const target = nextTrapTarget(items, document.activeElement as HTMLElement | null, event.shiftKey, root);
  if (target) {
    event.preventDefault();
    target.focus();
  }
}
