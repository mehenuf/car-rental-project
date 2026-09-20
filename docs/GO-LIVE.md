# Going live: upgrading the existing BestCar site

This guide upgrades the site that is already live at
`https://car-rental-project-mehenuf.vercel.app` (Vercel + Supabase) to this version. Follow it in order.
The order matters: **the database must be updated before, or at the same moment as, the new code.**

Allow about 60–90 minutes the first time. Do it at a quiet time.

> ⚠️ **Read this first.** If your Vercel project deploys automatically from `main`, pushing to `main` starts a
> deployment straight away. Until you finish step 3 (database migrations) and step 5 (environment variables), the new
> code will be running against the old database. Public pages in English will mostly work, but the account area,
> other-language car pages, the sitemap and the daily maintenance job will error. If that has already happened,
> do steps 1–5 now and then redeploy (step 6). If you want no gap at all, turn off auto-deploy in
> Vercel → Project → Settings → Git before you push, do steps 1–5, then turn it back on.

---

## 0. What is new in this version

- A marketplace: rental companies (with branches) and private owners, each with a provider portal.
- Customer accounts with driver-licence details and documents, receipts and trip pages.
- Notifications by email, SMS and web push, and messages between renter and provider.
- Reviews, disputes and safety checks.
- A platform admin console with staff roles, an audit log, four-eyes approvals and reports.
- 11 languages, cookie consent, data download and account deletion, retention, SEO, monitoring hooks.
- Database migrations `0012` to `0017`.

Payments are **simulated** unless you add Stripe test keys. Nothing here has been run against real payments.

---

## 1. Before you start: collect what you need

You need access to:

- [ ] The GitHub repository (this code is on `main`)
- [ ] The **Vercel** project for the live site
- [ ] The **Supabase** project the live site uses (Dashboard → SQL Editor)
- [ ] The email address of the account you use as admin today

Find your Supabase connection details in Supabase → Project Settings → API (URL, anon key, service-role key) and
Project Settings → Database (connection string, used only for the backup).

---

## 2. Back up the live database

Do not skip this. Migrations are written to add things rather than remove them, but a backup is your safety net.

**Option A – Supabase dashboard (paid plans):** Database → Backups → create/verify a recent backup.

**Option B – from your computer (works on the free plan).** Install PostgreSQL client tools, then run (use the
connection string from Supabase → Project Settings → Database → *Connection string* → URI; replace the password):

```bash
pg_dump "postgresql://postgres:YOUR_PASSWORD@db.YOUR_PROJECT.supabase.co:5432/postgres" \
  --schema=public --no-owner -f bestcar-backup-$(date +%F).sql
```

Keep the file somewhere safe (not in the repository).

---

## 3. Update the database

**Never run `schema.sql` on the live database. It drops tables.** You only run migration files.

### 3.1 Find out which migrations the live database already has

Open Supabase → SQL Editor → New query, paste this and run it:

```sql
select 'migrations 0001-0011 (core, pricing, payments, provider portal)' as step,
       to_regclass('public.providers') is not null
   and to_regclass('public.provider_members') is not null as applied
union all select '0012 customer account',        to_regclass('public.driver_profiles') is not null
union all select '0013 communications',          to_regclass('public.outbox_events') is not null
union all select '0014 reviews, disputes, safety', to_regclass('public.disputes') is not null
union all select '0015 platform admin',          to_regclass('public.platform_staff') is not null
union all select '0016 compliance',              to_regclass('public.consents') is not null
union all select '0017 retention and policies',  to_regproc('public.accept_policies') is not null;
```

Every row that says `false` must be applied, **in numeric order**. If the first row is `false`, your database is older
than this guide assumes: apply `0001` to `0011` first (from the `migrations/` folder), then continue.

### 3.2 Apply the missing migrations

For each missing file, in order (`0012`, `0013`, `0014`, `0015`, `0016`, `0017`):

1. Open the file from the `migrations/` folder in the repository.
2. Copy **all** of it into a new SQL Editor query and click **Run**.
3. Wait for "Success". If you see an error, **stop**. Do not run the next file. Read the error and ask for help before re-running anything: a file that fails part-way may have
   applied some of its statements, so check the state (step 3.1) before trying again.
4. Run the check query from 3.1 again to confirm that row is now `true`.

Things to know:

- `0012` replaces the function `record_inspection` (a new version that takes a licence-override reason). The old version
  of the site cannot hand over cars after this, so do not roll the code back past this point without a plan (see step 9).
- `0015` automatically turns every existing admin (accounts with the `admin` role) into a **super admin** in the new
  `platform_staff` table.
- `0010` and `0012` create private storage buckets. Check them in step 3.3.

### 3.3 Check storage buckets

Supabase → Storage. These three buckets must exist and be **private** (not public):

- `provider-documents`
- `booking-inspections`
- `customer-documents`

If one is missing, click **New bucket**, use the exact name, and leave "Public bucket" **off**.

---

## 4. Supabase Auth settings

Supabase → Authentication:

1. **URL Configuration:** Site URL = `https://car-rental-project-mehenuf.vercel.app` (or your own domain). Add the same
   address, and `https://car-rental-project-mehenuf.vercel.app/**`, to Redirect URLs. Password-reset and
   email-confirmation links depend on this.
2. **Multi-factor:** turn on **TOTP** (Authentication → Sign In / Providers → Multi-Factor → TOTP enabled).
   Staff must use an authenticator app to enter the admin console; without this setting they cannot enrol.
3. **Email confirmation:** the new site asks new customers to confirm their email. That needs an email sender.
   Either configure custom SMTP (Authentication → SMTP Settings; Resend works) or set the environment variable
   `AUTH_REQUIRE_EMAIL_VERIFICATION=false` (step 5) for a demo without email.

---

## 5. Vercel environment variables

Vercel → your project → Settings → Environment Variables. Add each for the **Production** environment. Variables you
already have (Supabase keys, `GROQ_API_KEY`, `GEMINI_API_KEY`, `N8N_WEBHOOK_URL`) stay as they are.

### Required for this version

| Name | Value |
|---|---|
| `QUOTE_SIGNING_SECRET` | 64 random characters. Generate: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` (if it already exists, leave it) |
| `CRON_SECRET` | Another long random value (same command). Vercel sends it to the daily job automatically. |
| `CONSENT_SALT` | Another long random value. Used to hash IP addresses in cookie-consent records. **Never change it later** unless you accept that old hashes stop matching. |
| `NEXT_PUBLIC_SITE_URL` | `https://car-rental-project-mehenuf.vercel.app` (no trailing slash; use your own domain if you have one) |

### Optional, add when you are ready

| Name | Purpose |
|---|---|
| `AUTH_REQUIRE_EMAIL_VERIFICATION` | `false` only if you have no email sender and want instant accounts |
| `ADMIN_REQUIRE_MFA` | Leave unset (staff must use a second factor). `false` is an emergency escape hatch only. |
| `RESEND_API_KEY`, `RESEND_FROM`, `RESEND_WEBHOOK_SECRET` | Real email (see step 8) |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_MESSAGING_SERVICE_SID`, `TWILIO_VERIFY_SERVICE_SID` | Real SMS and phone verification |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | Web push. Generate keys with `npx web-push generate-vapid-keys`; subject looks like `mailto:you@example.com` |
| `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET` | Stripe **test-mode** card payments |
| `SENTRY_DSN` | Error monitoring |

Without the optional ones, the site still works: emails and texts are logged instead of sent, and payments are
simulated.

After adding or changing any variable, you must **redeploy** (step 6) for it to take effect.

---

## 6. Deploy

The code is on the `main` branch of the GitHub repository.

1. Vercel → Deployments. If a deployment for the latest `main` commit is already running or has finished, and you have
   changed environment variables since it started, open its menu (⋯) and choose **Redeploy**.
2. Watch the build log. The build should end with "Compiled successfully" and list `/robots.txt` and `/sitemap.xml`.
3. If the build fails, open the error. The most common causes are a missing `NEXT_PUBLIC_SUPABASE_URL` or key.

Vercel Cron reads `vercel.json` and will call `/api/cron/maintenance` once a day at 03:00 UTC. The Hobby plan allows
one daily run, which is what is configured.

---

## 7. Check that it works

Replace `SITE` with your live address.

1. **Health:** open `SITE/api/health`. Expect `{"status":"ok","database":"up",...}`.
2. **Pages in several languages:** `SITE/en`, `SITE/de`, `SITE/ar` (right-to-left), `SITE/robots.txt`, `SITE/sitemap.xml`.
   A car page in another language should load (for example `SITE/de/cars/<a-real-slug>`).
3. **Admin and second factor:** sign in with your existing admin account and open `SITE/admin`. You will be sent to
   `/admin/mfa` to scan a QR code with an authenticator app (Google Authenticator, 1Password, Authy…). Finish it, then
   confirm the console opens. **Keep a backup of the authenticator secret or use an app that syncs.**
   If you lock yourself out: set `ADMIN_REQUIRE_MFA=false` in Vercel, redeploy, sign in, re-enrol, then remove the variable.
4. **Daily job, by hand** (proves the database and secrets work together):

   ```bash
   curl -H "Authorization: Bearer YOUR_CRON_SECRET" SITE/api/cron/maintenance
   ```

   Expect a JSON object with counts such as `expired_holds`, `payouts_paid`, `retention`. A `401` means the secret is
   wrong. A `503` means `CRON_SECRET` is not set on the deployment you are calling.
5. **A customer journey:** register a test account, add driver details on `SITE/en/account/driver`, find a car, book it
   (simulated payment), then open the trip page and the receipt.
6. **Privacy:** on `SITE/en/account/privacy`, download your data; open the site in a private window and confirm the
   cookie banner appears and analytics are off until you accept.
7. **Provider portal:** sign in as an existing provider owner at `SITE/provider`.

If something fails, note the URL and the time, then check Vercel → Logs (errors are written as JSON lines) and
Supabase → Logs.

---

## 8. Optional: turn on the real services

Do these one at a time, after everything above works.

**Resend (email).** Create an account, verify your sending domain, create an API key, set `RESEND_API_KEY` and
`RESEND_FROM` (for example `BestCar <bookings@yourdomain.com>`). Add a webhook pointing at
`SITE/api/webhooks/resend` for the events *email.delivered*, *email.bounced* and *email.complained*, and put its
signing secret in `RESEND_WEBHOOK_SECRET`. Redeploy.

**Twilio (SMS and phone checks).** Create a Messaging Service and a Verify Service, set the four `TWILIO_*` variables,
and set the messaging service's status callback to `SITE/api/webhooks/twilio`. Redeploy. Twilio requires sender
registration in many countries; check the rules for each country you serve.

**Web push.** Generate the VAPID keys, set the three `VAPID_*` variables, redeploy.

**Stripe (test mode).** Create a webhook endpoint at `SITE/api/webhooks/stripe` for the events
`payment_intent.succeeded` and `payment_intent.payment_failed`, put its signing secret in `STRIPE_WEBHOOK_SECRET`, set
the two API keys, and redeploy. Pay with Stripe's test card `4242 4242 4242 4242`. **Use only test keys until the
legal and compliance items below are complete.**

**Sentry.** Create a project, copy its DSN into `SENTRY_DSN`, redeploy.

---

## 9. If something goes wrong (rollback)

- **The new site is broken and you need the old one back immediately:** Vercel → Deployments → pick the last good
  deployment → ⋯ → **Promote to Production**. This is instant.
- **Caveat:** migration `0012` replaced the `record_inspection` function. If you have applied it, the *old* code cannot
  record car handovers or returns until you fix forward (redeploy the new code). Everything else in the old site keeps
  working because the migrations add tables and columns rather than removing them.
- **Restoring the database** from the step 2 backup is a last resort and loses any data created since. Ask for help
  before doing it.

---

## 10. Before real customers or real money

The site is built to production standards but has never processed a real payment, sent a real email or SMS, or been
reviewed by a lawyer. Complete `docs/compliance/go-live-checklist.md` first. In particular:

- [ ] Have privacy policy, terms and cookie text reviewed for each country you serve. The current pages are short
      English texts.
- [ ] Have each of the 10 non-English languages read by a native speaker. All are machine-drafted
      (`src/messages/status.json`).
- [ ] Sign data-processing agreements with Supabase, Vercel, Stripe, Resend, Twilio and any AI provider.
- [ ] Confirm the insurance and driver-licence policy with your insurer.
- [ ] Do a full end-to-end test with Stripe test cards, then with a small real payment before opening to the public.
- [ ] Set up an uptime monitor for `SITE/api/health` and check the Supabase backup schedule.

To publish a new version of the terms or privacy policy (this makes every signed-in user accept it again), add a row
in Supabase → SQL Editor:

```sql
insert into policy_versions (kind, version) values ('terms', '2027-01');
```

(`kind` is `terms`, `privacy` or `cookies`; only `terms` and `privacy` ask people to accept again.)

---

## Quick checklist

1. [ ] Backup taken
2. [ ] Migrations `0012`–`0017` applied and verified
3. [ ] Storage buckets exist and are private
4. [ ] Supabase Auth: URLs set, TOTP on, email sender or `AUTH_REQUIRE_EMAIL_VERIFICATION=false`
5. [ ] Vercel variables: `QUOTE_SIGNING_SECRET`, `CRON_SECRET`, `CONSENT_SALT`, `NEXT_PUBLIC_SITE_URL`
6. [ ] Deployed and build succeeded
7. [ ] `/api/health` ok, admin MFA enrolled, cron call returns JSON
8. [ ] Customer, provider and admin journeys checked
