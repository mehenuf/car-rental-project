# Short data-protection impact assessment

**Processing:** identity and driving-licence details of renters, and payments, in a marketplace.
**Risks:** licence data exposure; account takeover; over-retention; cross-border transfer.
**Controls:** licence number stored as last four characters only; documents in private storage with row-level security; staff second factor and audit log; retention job; export and erasure; rate limiting; strict headers and CSRF origin check; consent for analytics.
**Residual risk:** medium, dominated by staff access and provider-side handling. Revisit after the first real users and after any new data category.
