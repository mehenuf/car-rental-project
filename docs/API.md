# API reference

Every route is a Next.js route handler under `src/app/api`. Errors share one shape: `{ "error": { "message": "...", "issues"?: [...] } }`. Money in requests and responses is described per route; inside the database all amounts are integer minor units.


All routes live under `/api`. Routes marked **Admin only** require a logged-in session where the user's `app_metadata.role` is `"admin"`. Anyone else gets `401` with `{ "error": { "message": "Admin authentication required" } }`. Every route validates its input with Zod. An invalid request returns `400` with a list of the specific field errors.

## `GET /api/vehicles`

Public. Lists vehicles with optional filtering, sorting, and pagination.

**Query parameters:** `category` (one value or a comma-separated list, e.g. `popular,large`), `minPrice`, `maxPrice`, `seats`, `transmission` (`automatic`/`manual`), `fuel` (`petrol`/`diesel`/`hybrid`/`electric`), `available` (`true`/`false`), `locationId` (only vehicles with an active unit at that branch), `pickupLocationId` + `pickupDate` + `dropoffDate` (`YYYY-MM-DD`) with optional `dropoffLocationId` (availability search: only vehicles with a free unit for that trip), `sortBy` (`price_per_day`/`rating`/`created_at`/`name`), `sortOrder` (`asc`/`desc`), `page`, `pageSize`, `search` (matches name, brand, or slug).

**Sample response:**

```json
{
  "data": [
    {
      "id": "1e061cbc-28fb-487a-8d01-deeedb5feeb8",
      "slug": "honda-civic",
      "name": "Honda Civic",
      "brand": "Honda",
      "category": "popular",
      "price_per_day": 48,
      "seats": 5,
      "doors": 4,
      "transmission": "automatic",
      "fuel": "petrol",
      "image_url": "https://images.unsplash.com/photo-...",
      "gallery": ["https://images.unsplash.com/photo-..."],
      "description": "A reliable Honda Civic, well maintained and ready for your next trip.",
      "features": ["Reverse Camera", "Bluetooth"],
      "rating": 4.2,
      "review_count": 132,
      "stock": 3,
      "available": true,
      "location_id": 18,
      "created_at": "2026-08-29T10:55:48.134448+00:00"
    }
  ],
  "count": 24
}
```

## `POST /api/vehicles`

Admin only. Creates a vehicle.

**Body:** `slug`, `name`, `brand`, `category`, `price_per_day`, `transmission`, `fuel`, and `image_url` are required. `seats`, `doors`, `gallery`, `description`, `features`, `rating`, `review_count`, `stock`, `available`, and `location_id` are optional and fall back to database defaults. On create, `stock` is the number of fleet units to add at the vehicle's branch (`location_id`, or the first active branch); it cannot be changed with `PATCH`, since fleet size comes from the units.

**Sample response** (`201`): the created vehicle row, in the same shape as one item in `GET /api/vehicles`'s `data` array.

## `PATCH /api/vehicles`

Admin only. Updates a vehicle. The target row's `id` is sent in the request body rather than the URL.

**Body:** `id` (required) plus any subset of the same fields as create.

**Sample response:** the updated vehicle row.

## `DELETE /api/vehicles`

Admin only. Deletes a vehicle.

**Body:** `{ "id": "..." }`

**Sample response:**

```json
{ "success": true }
```

## `GET /api/vehicles/[slug]`

Public. Fetches a single vehicle by its slug.

**Sample response:** a single vehicle object, in the same shape as one item in `GET /api/vehicles`'s `data` array. Returns `404` if the slug does not match any vehicle.

## `GET /api/bookings`

Admin only. Lists bookings with the vehicle's name and image joined in.

**Query parameters:** `status` (`pending`/`confirmed`/`active`/`completed`/`cancelled`/`no_show`), `sortBy` (`created_at`/`total_amount`/`pickup_at`), `sortOrder`, `page`, `pageSize`, `startDate`, `endDate` (both `YYYY-MM-DD`, filtered on `created_at`), `search` (matches customer name or booking reference).

**Sample response:**

```json
{
  "data": [
    {
      "id": "63591cf3-771b-45be-b3ec-98a0038ee900",
      "reference": "BC-05F982",
      "vehicle_id": "0eab810e-f1d2-4ca4-8abc-6a794f7504f0",
      "customer_name": "Haffaz Aladeen",
      "email": "aladeen@example.com",
      "phone": "665332167",
      "pickup_branch_id": null,
      "dropoff_branch_id": null,
      "pickup_at": "2026-08-29T18:00:00+00:00",
      "dropoff_at": "2026-08-30T18:00:00+00:00",
      "days": 1,
      "total_amount": 45,
      "payment_method": null,
      "status": "pending",
      "lead_score": null,
      "source": "web",
      "created_at": "2026-08-29T21:28:58.304193+00:00",
      "vehicle": { "name": "Toyota Corolla", "image_url": "https://images.unsplash.com/photo-..." }
    }
  ],
  "count": 23
}
```

## `POST /api/quote`

Public, rate-limited to 30 requests per minute per visitor. Prices a trip and returns a signed token valid for 15 minutes. Answers `409` if no car is free for the dates, so an unbookable trip is never quoted.

**Body:** `vehicle_id`, `pickup_at`, `dropoff_at` are required. `pickup_branch_id`, `dropoff_branch_id` (default to the vehicle's home branch), `extras` (`[{ "code": "seat", "quantity": 1 }]`), `promo_code`, `driver_age` are optional.

**Sample response:**

```json
{
  "quote": {
    "currency": "USD",
    "days": 3,
    "lines": [
      { "kind": "base", "label": "Base rate (3 days)", "quantity": 3, "amountMinor": 14400 },
      { "kind": "weekend", "label": "Weekend rate", "amountMinor": 960 },
      { "kind": "extra", "code": "cdw", "label": "Collision damage waiver", "quantity": 1, "amountMinor": 3600 }
    ],
    "subtotalMinor": 18960,
    "taxMinor": 0,
    "serviceFeeMinor": 0,
    "totalMinor": 18960,
    "depositMinor": 20000,
    "providerPayoutMinor": 16116,
    "platformRevenueMinor": 2844,
    "cancellationTiers": [{ "hoursBefore": 48, "refundBp": 10000 }, { "hoursBefore": 0, "refundBp": 0 }]
  },
  "token": "eyJ...",
  "expires_at": "2030-03-01T10:15:00.000Z",
  "available_extras": [{ "code": "seat", "name": "Child seat", "pricing": "per_day", "unitPriceMinor": 800, "maxQuantity": 2, "isMandatory": false }]
}
```

All amounts are integer minor units (cents) of `quote.currency`. The total already contains every mandatory fee and tax; the deposit is a separate refundable hold. Billable days are whole 24 hour periods rounded up after a 59 minute grace.

## `POST /api/payments/intents`

Public, rate-limited to 10 requests per minute. Pays for the caller's own pending booking (the signed-in user or the guest cookie that created it). Repeating the same `attempt` replays the stored result, so it can never charge twice.

**Body:** `reference`, `method` (`card`, `paypal`, `apple_pay`, `google_pay`, `ideal`, `upi`, `bkash`, `mpesa`; local methods only for their country and currency), `attempt` (one id per submit of the form), `test_input` (simulated provider only).

**Response:** `{ "payment_id": "...", "status": "succeeded" | "requires_action" | "processing" | "failed", "failure_code": null, "client_secret": null }`. The refundable security deposit is authorized first (no money moves), then the charge is made. A failed charge releases the deposit hold.

Simulated test values: a card ending `0002` declines, `9995` has insufficient funds, `0069` is expired, `3220` asks for a confirmation code (`000000` approves). For other methods type `decline` or `pending`. Typing `nodeposit` makes the deposit hold fail.

## `POST /api/payments/[id]/confirm`

Completes a simulated payment that returned `requires_action`. **Body:** `{ "code": "000000" }`.

## `POST /api/bookings/[id]/cancel`

A customer cancels their own booking. The refund follows the cancellation tiers stored in the booking's price snapshot (for example free until 48 hours before pick-up, then 50%, then nothing). **Response:** `{ "refund_minor": 20000, "refund_bp": 10000, "refund_status": "none" | "succeeded" | "failed" }`. An admin cancelling through `PATCH /api/bookings/[id]` refunds in full.

## `POST /api/webhooks/stripe`

Stripe's server-to-server notifications, authenticated by the signature over the raw body (`STRIPE_WEBHOOK_SECRET`). Handles `payment_intent.succeeded` and `payment_intent.payment_failed`; every other event is acknowledged and ignored.

## `GET /api/cron/maintenance`

Protected by `CRON_SECRET`. Cancels unpaid bookings whose 15 minute hold expired (and frees their cars), releases security deposits 48 hours after completion, and pays out due provider earnings (simulated bank transfer). Every step is idempotent. `vercel.json` schedules it daily; correctness does not depend on the schedule because expired holds are also swept whenever someone quotes or books.

## `POST /api/bookings`

Public. This is what the customer-facing booking form calls. `status` and `lead_score` are deliberately not accepted here. Every new booking starts as `pending` with no score, no matter what the request contains.

**Body:** `vehicle_id`, `customer_name`, `email`, `pickup_at`, `dropoff_at` are required. `phone`, `pickup_branch_id`, `dropoff_branch_id` (both default to the vehicle's home branch; drop-off defaults to pick-up), `payment_method`, `source` (`web`/`chat`/`phone`), `extras`, `promo_code`, `driver_age` and `quote_token` (from `POST /api/quote`) are optional.

**Sample response** (`201`):

```json
{
  "id": "97fe83c3-b24f-484f-ad5b-249e39244926",
  "reference": "BC-F86688",
  "vehicle_id": "1e061cbc-28fb-487a-8d01-deeedb5feeb8",
  "customer_name": "Jane Doe",
  "email": "jane@example.com",
  "phone": "+1234567890",
  "pickup_at": "2026-09-01T10:00:00+00:00",
  "dropoff_at": "2026-09-03T10:00:00+00:00",
  "days": 2,
  "total_amount": 96,
  "payment_method": null,
  "status": "pending",
  "lead_score": null,
  "source": "web",
  "created_at": "2026-08-30T11:50:13.536378+00:00"
}
```

`total_amount` (major units) is calculated on the server by the quote engine from the vehicle's rate plan, extras, fees and taxes for that branch. It is never trusted from the client. If no unit of the vehicle is free for the dates, the response is `409`. With a `quote_token`, the server re-prices the trip and, if the total changed, answers `409` with `{ error: { code: "PRICE_CHANGED" }, quote }` instead of booking at a different price. Every booking stores the accepted quote as an immutable `price_snapshot`. A new booking is `pending` and **held for 15 minutes**; the customer is sent to `/checkout/[reference]` to pay, and payment confirms it. On success, the booking's details are also sent to the n8n webhook URL in the background, but no automation currently acts on that particular event. See section 9 for details.

## `PATCH /api/bookings/[id]`

Admin only. Changes a booking's status. This is the one place status can be set directly.

**Body:** `{ "status": "pending" | "confirmed" | "active" | "completed" | "cancelled" | "no_show" }`

Allowed moves: `pending` to `confirmed` or `cancelled`; `confirmed` to `active`, `cancelled` or `no_show`; `active` to `completed`. Anything else returns `409`. Cancelling or marking no-show frees the car for those dates; completing a one-way rental moves the car to the drop-off branch.

**Sample response:** the updated booking row, in the same shape as one item in `GET /api/bookings`'s `data` array (without the joined `vehicle` field).

## `GET /api/locations`

Public. No parameters. Powers the pickup and drop-off location dropdowns.

**Sample response:**

```json
[
  { "id": 19, "city": "Dubai", "country": "United Arab Emirates", "country_code": "AE", "created_at": "2026-08-29T10:55:47.981804+00:00" }
]
```

## `GET /api/leads`

Admin only. Lists AI-scored leads, highest score first.

**Query parameters:** `page`, `pageSize`.

**Sample response:**

```json
{
  "data": [
    {
      "id": "a069430c-1d45-45bd-a864-0780d04b8244",
      "name": null,
      "email": null,
      "phone": null,
      "intent_summary": "Customer wants to rent an 8-seat Kia Carnival for next Monday at 6 pm.",
      "budget_band": "mid",
      "urgency": "this_week",
      "score": 85,
      "next_action": "Confirm availability for the Kia Carnival and send a booking confirmation.",
      "transcript": [{ "role": "user", "content": "..." }],
      "source": "chat",
      "notified": false,
      "created_at": "2026-08-30T11:51:45.264576+00:00"
    }
  ],
  "count": 14
}
```

## `GET /api/stats`

Admin only. Dashboard headline numbers for a date range, plus the percentage change against the same-length period immediately before it.

**Query parameters:** `startDate`, `endDate` (both required, `YYYY-MM-DD`).

**Sample response:**

```json
{
  "totalRevenue": 6351,
  "salesCount": 17,
  "purchaseCount": 22,
  "revenueChangePercent": 11
}
```

`revenueChangePercent` is `null` when the previous period had zero revenue, since there is no baseline to compare against.

## `GET /api/best-sellers`

Admin only. Top vehicles by number of bookings, all time.

**Query parameters:** `limit` (default 5). `startDate` and `endDate` are accepted for symmetry with the other endpoints, but they currently have no effect. See section 10.

**Sample response:**

```json
[
  { "id": "...", "name": "Honda Pilot", "brand": "Honda", "image_url": "...", "price_per_day": 105, "sales_count": 10, "revenue": 1050 }
]
```

## `GET /api/monthly-sales`

Admin only. Revenue for each of the 12 months of a given year, zero-filled for months with no bookings.

**Query parameters:** `year` (required).

**Sample response:**

```json
[
  { "month": 1, "revenue": 0 },
  { "month": 8, "revenue": 6351 }
]
```

## `GET /api/sales-by-country`

Admin only. Bookings grouped by customer country, all time.

**Query parameters:** `startDate` and `endDate` are accepted but currently have no effect, for the same reason as best-sellers.

**Sample response:**

```json
[
  { "country": "United States", "country_code": "US", "sales_count": 31, "revenue": 3200 }
]
```

## `POST /api/auth/signup`

Public. Creates a customer account that is pre-confirmed, so no confirmation email is required.

**Body:** `fullName`, `email`, `password` (minimum 6 characters).

**Sample response** (`201`): `{ "ok": true }`. Returns `409` if the email is already registered.

## `POST /api/chat`

Public, rate-limited to 10 requests per minute per visitor IP address. Streams back a plain-text reply from the chat assistant.

**Body:** `{ "messages": [{ "role": "user" | "assistant", "content": "..." }], "customer_name"?: string, "customer_email"?: string }` (1 to 20 messages).

**Sample response:** a plain-text stream, for example:

```
We have several SUVs: Toyota Land Cruiser ($120/day), Ford Explorer ($110/day).
<recommendations>toyota-land-cruiser, ford-explorer</recommendations>
```

The `<recommendations>` tag is stripped out by the chat widget before it is shown to the visitor. The widget uses it to fetch and display picture cards for those two cars.

## `POST /api/chat/score`

Public, but only ever called by the chat widget itself in the background, never by a user directly. Silently scores a conversation and saves it as a lead. Always returns `204 No Content`, even if something inside failed, so it can never disrupt the visible chat.

**Body:** same shape as `POST /api/chat`'s body, but requires at least 3 messages. Shorter conversations are skipped.

