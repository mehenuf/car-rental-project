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
