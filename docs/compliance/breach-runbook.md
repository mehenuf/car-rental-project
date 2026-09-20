# Personal-data breach runbook

1. **Detect and contain** (first hour): revoke affected keys/sessions, disable the affected route, keep logs (`audit_log`, platform logs).
2. **Assess:** what data, how many people, which countries, is it encrypted or exposed.
3. **Notify:** regulators within the local deadline (EU/UK 72 hours from awareness; check each country in the matrix) and affected people without undue delay when risk is high.
4. **Record:** date, facts, effects, actions, in the breach register.
5. **Fix and review:** root cause, regression test, update the DPIA.

Contacts to fill in before launch: incident lead, DPO or privacy officer, legal counsel, hosting and payment providers.
