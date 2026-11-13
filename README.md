# Barber Booking Marketplace — Production Codebase

A complete Barber Booking, Navigation & Payment Management Marketplace for one
city in Pakistan. Customers find nearby barber shops, book a time slot online
and arrive at their booked time — no waiting in line. Shops register, manage
services and bookings; Finance tracks every rupee in and out; Admin manages
users, shops, disputes and the full database.

**Stack:** Next.js 14 (App Router, TypeScript) · Tailwind CSS · Supabase
(Postgres + Auth + Row Level Security). **Zero budget:** Supabase free tier +
Vercel free tier. Maps: OpenStreetMap + Leaflet (free, no API key).

> **Payments are SIMULATED in this build.** Every payment is labelled
> "Simulated" in the UI and no real money moves. Real JazzCash / Easypaisa /
> bank integration is a later phase — see "Real payments (later phase)" below.
> Customer funds are never held in a personal account; the code treats funds
> as platform-ledger entries only.

## Panels & flow

| Panel | Route | What it does |
|---|---|---|
| Customer | `/` (Find a Barber), `/shop/[id]`, `/bookings` | Nearby shops (map + list, distance, 1/3/5 km filters, nearest-first, Directions), shop profiles, booking requests, My Bookings, "I Have Arrived" + 4-digit OTP check-in, reviews |
| Barber | `/barber` | Shop registration + profile, services, barbers in the shop, opening hours, accept/reject requests, Start/End Work, Mark Not Arrived, earnings + payout requests |
| Finance | `/finance` | Pay In list, Pay Out workflow (Requested → Approved → Paid), running balances, full ledger |
| Admin | `/admin` | Users, shops (approve/suspend/reject/delete), bookings, disputes, reports, full Database browser |

**Exact flow:** booking request → barber accept/reject → payment link →
customer pays the full amount in advance → payment verified → booking
confirmed (+ 4-digit OTP) → check-in within 15 minutes → Start Work → End
Work → settlement. Statuses: Requested, Awaiting Payment, Paid, Confirmed,
In Progress, Completed, No Show, Refund Pending, Settled (plus Cancelled /
Rejected).

**Settlement rules (exact, do not change):**

| Case | Split |
|---|---|
| Completed booking, Rs 1,000 | Barber Rs 900 / platform Rs 100 (10% commission) |
| No-show (15-min wait, barber marks Not Arrived) | Barber waiting Rs 100 / platform Rs 100 / customer refund Rs 800 |
| Disputed no-show resolved for the customer | Full refund Rs 1,000 |

Settlement is held while a dispute is open. A barber **cannot** no-show a
checked-in customer — the server enforces this.

## Project structure

```
app/                    Next.js App Router pages (all four panels + auth)
components/             Nav, MapView (Leaflet), shared UI kit
lib/
  config.ts             City (NEXT_PUBLIC_CITY), commission, check-in window
  types.ts              Shared TypeScript types (money = integer PKR)
  settlement.ts         Pure settlement maths (unit-tested, see below)
  geo.ts                Distance, opening-hour slots, Directions URLs
  supabase.ts           Browser + service-role clients (lazy)
  auth.ts               Server-side auth helpers (never trust client ids)
  payments.ts           SIMULATED payments + real-provider integration points
  actions.ts            Server actions: shops, services, booking flow,
                        check-in, work, no-show, disputes
  actions-finance.ts    Payouts, dispute resolution, reviews, admin, DB browser
  data.ts               Read helpers (browser client, RLS-protected)
scripts/
  verify-settlement.ts  Settlement maths test (npm run verify:settlement)
supabase/
  migrations/0001_init.sql   Full schema + RLS policies + auth triggers
  seed.sql                    Intentionally empty — live DB starts empty
```

## Setup

### 1. Supabase project (free tier)

1. Create a project at https://supabase.com (free tier).
2. In the Supabase dashboard → **SQL Editor**, paste and run
   `supabase/migrations/0001_init.sql` (the whole file, in order).
3. `supabase/seed.sql` seeds **nothing** on purpose — the live database
   starts empty. The first real shop registers and is admin-approved.
4. Copy the project URL + anon key from **Project Settings → API**, and the
   service-role key (keep it server-only).

### 2. Environment variables

```bash
cp .env.example .env.local
# fill in:
#   NEXT_PUBLIC_SUPABASE_URL
#   NEXT_PUBLIC_SUPABASE_ANON_KEY
#   SUPABASE_SERVICE_ROLE_KEY   (server only — never NEXT_PUBLIC_)
#   NEXT_PUBLIC_CITY            (launch city; still TBD — leave as "Your City")
```

### 3. Make the first admin

After your first sign-up, in the Supabase SQL editor run:

```sql
update public.profiles set role = 'admin' where email = 'you@example.com';
```

Sign-up can only ever create `customer` or `barber` accounts — admin and
finance roles are granted by an existing admin, and a database trigger blocks
non-admins from changing anyone's role.

### 4. Run locally

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # production build check
npm run verify:settlement   # settlement maths test
```

## Deploy (Vercel, free tier)

1. Push this folder to a GitHub repo (the repo is created separately — do not
   push from here).
2. In Vercel: **Add New → Project → import the repo**.
3. Set the same four environment variables from `.env.example` in
   **Project Settings → Environment Variables**.
4. Deploy. Framework preset: Next.js. No build command changes needed
   (`npm run build`).

## Verification

- `npm run build` — must pass with no errors.
- `npm run verify:settlement` — checks the money rules:
  - Rs 1,000 completed = barber 900 / platform 100
  - Rs 1,000 no-show = waiting 100 / platform 100 / refund 800
  - disputed no-show for the customer = full Rs 1,000 refund
  - every split adds back up to the original amount (Rs 333–5,000 tested)
  - OTP is a 4-digit code

## Real payments (later phase)

Payments in this build are simulated (`lib/payments.ts`, `PAYMENTS_MODE =
'simulated'`). To go live you need an **authorised payment-provider / bank
marketplace arrangement** first (JazzCash, Easypaisa, bank). When that exists:

1. Add the provider credentials to the environment (placeholders are already
   in `.env.example` — commented out on purpose).
2. Replace `simulatePayment()` in `lib/payments.ts` with the provider's
   checkout + webhook verification (marked `INTEGRATION POINT`). The booking
   flow only confirms a booking after this function reports a successful
   payment, so the flow itself does not change.
3. Flip payment records from `status: 'simulated'` to `'verified'` and update
   the UI badges. Do not present simulated payments as real money movement.

## Known simplifications

- **Maps** use OpenStreetMap + Leaflet (free). Google Maps is a later phase
  (billing/limits) — the Directions button already links to Google Maps.
- **Notifications** (SMS/WhatsApp) are not wired yet — booking updates are
  visible in-app on My Bookings / Barber Panel.
- **No mobile app yet** — the web app is mobile-first responsive; an Expo
  app is a future phase.
- The **city is configurable** (`NEXT_PUBLIC_CITY`) and defaults to
  "Your City" until the launch city is chosen.
- Shop location on the map needs the shop's latitude/longitude; registration
  accepts them optionally (a map picker is a small future addition).
