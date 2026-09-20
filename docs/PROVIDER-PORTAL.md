# Provider portal

Rental companies and private owners apply at `/provider/apply`, upload verification documents (private storage, short-lived links), and are reviewed by a platform admin at `/admin/providers`. Once approved they use the portal at `/provider`:

| Page | What it does |
|---|---|
| Overview | Earnings this month, bookings, today's pick-ups and returns, 30-day utilisation |
| Fleet / My cars | Add cars from the catalogue with a first price, take them off the road, submit a private owner's car for review |
| Calendar / Availability | Month grid of every car; block days; a private owner opens the days a car may be booked |
| Bookings / Requests | Hand cars over and take them back with odometer, fuel, notes and photos (a return schedules the payout), no-show, cancel with a full refund |
| Pricing | Daily price, weekend uplift, weekly and monthly discounts, seasons, extras, cancellation tiers, deposit, driver-age rules, promo codes, one-way fees |
| Payouts / Earnings | Scheduled and paid earnings, payout account (last four digits only) |
| Team | Owners add existing accounts by email as managers or agents, optionally limited to one branch |
| Settings | Profile, branches (the exact address is private), verification documents |

Roles: **owner** does everything; **manager** everything except the team and the payout account; **agent** only hands cars over and takes them back. Every `/api/provider/*` route resolves the caller's membership on the server, filters by their provider and never trusts a provider id from the request. The two Storage buckets (`provider-documents`, `booking-inspections`) are private and created by migration `0010` where the Supabase Storage schema exists.
