# Accessibility checklist

Automated: axe-core (WCAG 2.0/2.1 A and AA) through Playwright in `e2e/a11y.spec.ts`. It fails on serious and critical findings, evaluated with reduced motion so mid-animation contrast is not judged.

| Page | axe serious/critical | Lighthouse a11y |
|---|---|---:|
| /en | pass | 100 |
| /en/about | pass | 100 |
| /en/contact | pass | 100 |
| /en/login | pass | 100 |
| /en/register | pass | 100 |
| /en/privacy | pass | 100 |
| /ar/login (right-to-left) | pass | not run |

Manual checks done: skip link present; one h1 per page; the city grid can be focused and opened with the keyboard; the location combobox uses the ARIA combobox pattern with keyboard navigation (tested in `booking-ui.spec.ts`).

**Not done:** screen-reader run-through, 200% zoom visual review beyond overflow, admin pages under axe, focus-management review of dialogs, contrast review in the light theme.

## Keyboard, focus and accessibility-tree pass (2026-09-21)

Labels: **Measured** = produced by a script in this repo; **Not run** = could not be done here.

- **Measured, dialog focus:** `e2e/dialogs.spec.ts` (7 tests) opens the booking dialog (keyboard and mouse), mobile menu, filters sheet, language menu, location picker and chat, and checks focus moves in, stays trapped on Tab/Shift+Tab, and returns on Escape. Mouse-opened Base UI dialogs leaked focus to the page behind; fixed with `src/lib/focus-trap.ts` on the dialog and sheet popups.
- **Measured, accessibility tree:** `e2e/a11y-tree.spec.ts` checks 7 public pages for one `h1`, no skipped heading levels, one `main`/banner/footer, a named main navigation, no unnamed links or buttons, labelled form fields, alt on every image, and a `lang` attribute; plus a live region announcing the cars result count. Fixes: footer column titles h3 to h2, named `nav` landmarks, `role="status"` on the result count and on the booking total.
- **Measured, touch targets (390 px, coarse pointer):** `scripts/perf/touch-targets.cjs` on 7 public pages and 5 admin pages lists nothing under 44 px except hidden 1x1 native inputs. Layout size is used, so reveal transforms do not skew the result.
- **Not run:** a real screen-reader session (NVDA, JAWS, VoiceOver, TalkBack). It needs a GUI screen reader and spoken output, which this environment cannot operate. The checks above read the browser's accessibility tree and are not a substitute. Recommendation: a manual pass on the home page, cars list, vehicle booking and login with NVDA + Firefox and VoiceOver + Safari before launch.

## Admin audit (2026-09-21)

**Measured** with `scripts/perf/admin-audit.cjs` (axe WCAG 2 A/AA/2.2 AA, horizontal overflow, screenshots) on 12 admin pages at 1280 px and 390 px, signed in with credentials from environment variables.

- Before: unnamed select triggers (`button-name`, bookings, vehicles, dashboard) and low contrast on the sidebar group labels (3:1) and on blue status text in dark mode (4.2 to 4.5:1). No horizontal overflow at either width.
- Fixed: `aria-label` on the status, category and year selects; sidebar group labels raised from 45% to 75% opacity; dark-mode `--info-text` lightened.
- After: 24 of 24 views report no axe violations and no overflow.
- **Observed** (screenshots, not scored): bookings collapse to labelled cards on phones and the dashboard hierarchy is clear, so no layout restyling was made. Not covered: axe checks only part of WCAG; forms inside dialogs and the MFA screen were not exercised.
