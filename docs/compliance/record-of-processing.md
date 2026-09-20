# Record of processing and retention

| Data | Purpose | Lawful basis | Retention | Mechanism |
|---|---|---|---|---|
| Account (name, email, phone) | Provide the service | Contract | Life of account; anonymised on erasure | `erase_user` |
| Driver profile and licence documents | Verify renter may drive | Contract / legal obligation | Kept while the profile exists; removed on erasure. **No automatic time-based purge yet** | `erase_user` |
| Bookings, payments, ledger | Contract, accounting, tax | Legal obligation | Kept (anonymised on erasure) | Append-only tables |
| Messages | Renter–provider coordination | Contract | Kept; anonymised on erasure. **No automatic time-based purge yet** | `erase_user` |
| Notification logs, outbox | Delivery and debugging | Legitimate interest | Purged after `retention_rules` days | `apply_retention` |
| Analytics cookie | Site improvement | Consent | Cookie: 1 year; consent recorded in `consents` | Consent banner |
| Audit log | Security, accountability | Legitimate interest | Kept; personal fields redacted in exports | Append-only |

`apply_retention` (run daily by the maintenance cron) currently purges notifications, outbox events, rate-limit rows and anonymous consent records using days from `retention_rules`. Time-based purging of licence documents and messages is a known gap to settle with counsel.
