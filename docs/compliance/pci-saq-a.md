# PCI DSS: SAQ A statement

Card entry happens in Stripe-hosted fields (Stripe Elements / Checkout). Card numbers, CVC and expiry never reach or are stored by this application, logs or database; only Stripe tokens and identifiers are kept. The site is served over HTTPS with a CSP that limits scripts to our origin and `js.stripe.com`. This qualifies for SAQ A. The self-assessment must be completed and attested by the operating company in the Stripe dashboard. **This build uses simulated payments; nothing here has been tested against live Stripe.**
