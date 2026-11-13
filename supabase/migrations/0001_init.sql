-- Barber Booking Marketplace — initial schema.
-- Run in the Supabase SQL editor or via `supabase db push`.
-- Money is integer PKR everywhere. Payments are SIMULATED only — see
-- lib/payments.ts. The live database starts EMPTY by design (seed.sql
-- seeds nothing); the first real shop registers and is admin-approved.
--
-- ORDER MATTERS: tables are created before the helper functions and
-- policies that reference them. `bookings` and `disputes` reference each
-- other, so the bookings→disputes foreign key is added afterwards with
-- ALTER TABLE instead of inline.

-- ── profiles ────────────────────────────────────────────────────────────

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text,
  phone text,
  role text not null default 'customer'
    check (role in ('customer', 'barber', 'admin', 'finance')),
  created_at timestamptz not null default now()
);

-- ── shops ───────────────────────────────────────────────────────────────

create table public.shops (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  area text not null,
  city text not null,
  address text not null,
  lat double precision,
  lng double precision,
  phone text,
  description text,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'suspended', 'rejected')),
  opening_time text not null default '09:00',
  closing_time text not null default '21:00',
  created_at timestamptz not null default now()
);
create index shops_owner_idx on public.shops (owner_id);
create index shops_status_idx on public.shops (status);
create index shops_city_idx on public.shops (city);

-- ── services ────────────────────────────────────────────────────────────

create table public.services (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id) on delete cascade,
  name text not null,
  price integer not null check (price >= 0),
  duration_minutes integer not null default 30 check (duration_minutes > 0),
  description text,
  created_at timestamptz not null default now()
);
create index services_shop_idx on public.services (shop_id);

-- ── barbers (individual barbers inside a shop) ─────────────────────────

create table public.barbers (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id) on delete cascade,
  name text not null,
  phone text,
  specialty text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index barbers_shop_idx on public.barbers (shop_id);

-- ── bookings ────────────────────────────────────────────────────────────
-- NOTE: the dispute_id foreign key is added AFTER the disputes table
-- below (bookings and disputes reference each other).

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id) on delete cascade,
  service_id uuid not null references public.services (id) on delete restrict,
  barber_id uuid references public.barbers (id) on delete set null,
  customer_id uuid not null references public.profiles (id) on delete cascade,
  date date not null,
  time_slot text not null,
  notes text,
  status text not null default 'requested' check (status in (
    'requested', 'awaiting_payment', 'paid', 'confirmed', 'in_progress',
    'completed', 'no_show', 'refund_pending', 'settled', 'cancelled', 'rejected'
  )),
  amount integer not null check (amount >= 0),
  otp_code text,
  checked_in_at timestamptz,
  dispute_id uuid,
  created_at timestamptz not null default now()
);
create index bookings_shop_idx on public.bookings (shop_id);
create index bookings_customer_idx on public.bookings (customer_id);
create index bookings_status_idx on public.bookings (status);
create index bookings_date_idx on public.bookings (date);

-- ── payments (SIMULATED in this build) ─────────────────────────────────

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete cascade,
  amount integer not null check (amount >= 0),
  method text not null check (method in ('jazzcash', 'easypaisa', 'bank', 'card')),
  status text not null default 'simulated'
    check (status in ('simulated', 'verified', 'failed')),
  simulated boolean not null default true,
  reference text,
  created_at timestamptz not null default now()
);
create index payments_booking_idx on public.payments (booking_id);

-- ── payouts (barber payouts + customer refunds) ────────────────────────

create table public.payouts (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid references public.shops (id) on delete set null,
  booking_id uuid references public.bookings (id) on delete set null,
  type text not null check (type in ('barber_payout', 'refund')),
  amount integer not null check (amount >= 0),
  status text not null default 'requested'
    check (status in ('requested', 'approved', 'paid')),
  requested_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index payouts_shop_idx on public.payouts (shop_id);
create index payouts_status_idx on public.payouts (status);

-- ── ledger_entries (every rupee, signed: + in, − out) ──────────────────

create table public.ledger_entries (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid references public.bookings (id) on delete set null,
  type text not null check (type in (
    'payment_received', 'commission', 'barber_payable',
    'waiting_compensation', 'refund', 'payout'
  )),
  amount integer not null,
  description text not null,
  created_at timestamptz not null default now()
);
create index ledger_booking_idx on public.ledger_entries (booking_id);
create index ledger_type_idx on public.ledger_entries (type);

-- ── disputes ────────────────────────────────────────────────────────────

create table public.disputes (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete cascade,
  raised_by uuid not null references public.profiles (id) on delete cascade,
  reason text not null,
  status text not null default 'open'
    check (status in ('open', 'resolved_customer', 'resolved_barber')),
  resolution_note text,
  created_at timestamptz not null default now()
);
create index disputes_booking_idx on public.disputes (booking_id);
create index disputes_status_idx on public.disputes (status);

-- bookings → disputes foreign key (added now that both tables exist).
alter table public.bookings
  add constraint bookings_dispute_id_fkey
  foreign key (dispute_id) references public.disputes (id) on delete set null;

-- ── reviews (one 1–5 star review per completed booking) ────────────────

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete cascade,
  shop_id uuid not null references public.shops (id) on delete cascade,
  customer_id uuid not null references public.profiles (id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  constraint one_review_per_booking unique (booking_id)
);
create index reviews_shop_idx on public.reviews (shop_id);

-- ── Helpers (defined AFTER the tables they reference) ──────────────────

create or replace function public.current_role()
returns text
language sql
stable
security definer
as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.is_shop_owner(p_shop_id uuid)
returns boolean
language sql
stable
security definer
as $$
  select exists (
    select 1 from public.shops
    where id = p_shop_id and owner_id = auth.uid()
  )
$$;

-- Auto-create a profile row when a user signs up (default role: customer).
-- Give the first admin their role in the SQL editor:
--   update public.profiles set role = 'admin' where email = 'you@example.com';
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
as $$
declare
  requested_role text := coalesce(new.raw_user_meta_data ->> 'role', 'customer');
begin
  -- Sign-up may only ever request 'customer' or 'barber'. Admin and
  -- finance roles are granted by an existing admin, never by sign-up.
  if requested_role not in ('customer', 'barber') then
    requested_role := 'customer';
  end if;
  insert into public.profiles (id, email, full_name, phone, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', null),
    coalesce(new.raw_user_meta_data ->> 'phone', null),
    requested_role
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Nobody except an admin can change a profile's role (blocks self-promotion
-- to admin/finance through the "own row" update policy).
create or replace function public.prevent_role_escalation()
returns trigger
language plpgsql
security definer
as $$
begin
  -- Blocked only for a signed-in non-admin user. Backend calls (service
  -- role) and the SQL editor have no auth.uid(), so admin assignment
  -- through those paths still works.
  if old.role is distinct from new.role
     and auth.uid() is not null
     and public.current_role() <> 'admin' then
    raise exception 'Only an admin can change a profile role.';
  end if;
  return new;
end;
$$;

create trigger prevent_role_escalation
  before update on public.profiles
  for each row execute function public.prevent_role_escalation();

-- ── Row Level Security ──────────────────────────────────────────────────

alter table public.profiles enable row level security;
alter table public.shops enable row level security;
alter table public.services enable row level security;
alter table public.barbers enable row level security;
alter table public.bookings enable row level security;
alter table public.payments enable row level security;
alter table public.payouts enable row level security;
alter table public.ledger_entries enable row level security;
alter table public.disputes enable row level security;
alter table public.reviews enable row level security;

-- profiles: read/update your own; admins read all.
create policy "profiles: own row" on public.profiles
  for all using (id = auth.uid());
create policy "profiles: admin reads all" on public.profiles
  for select using (public.current_role() = 'admin');

-- shops: anyone can see APPROVED shops (customer discovery, incl. anon);
-- owners manage their own; admins manage all.
create policy "shops: public sees approved" on public.shops
  for select using (status = 'approved');
create policy "shops: owner manages own" on public.shops
  for all using (owner_id = auth.uid());
create policy "shops: admin manages all" on public.shops
  for all using (public.current_role() = 'admin');

-- services: public sees services of approved shops; owners manage own.
create policy "services: public sees approved shop services" on public.services
  for select using (
    exists (select 1 from public.shops s where s.id = shop_id and s.status = 'approved')
  );
create policy "services: owner manages own" on public.services
  for all using (public.is_shop_owner(shop_id));
create policy "services: admin manages all" on public.services
  for all using (public.current_role() = 'admin');

-- barbers: same pattern as services.
create policy "barbers: public sees approved shop barbers" on public.barbers
  for select using (
    exists (select 1 from public.shops s where s.id = shop_id and s.status = 'approved')
  );
create policy "barbers: owner manages own" on public.barbers
  for all using (public.is_shop_owner(shop_id));
create policy "barbers: admin manages all" on public.barbers
  for all using (public.current_role() = 'admin');

-- bookings: the customer owns theirs; the shop owner sees their shop's;
-- admin/finance see all. Writes go through server actions (service role).
create policy "bookings: customer owns" on public.bookings
  for all using (customer_id = auth.uid());
create policy "bookings: shop owner sees own shop" on public.bookings
  for select using (public.is_shop_owner(shop_id));
create policy "bookings: admin and finance see all" on public.bookings
  for select using (public.current_role() in ('admin', 'finance'));

-- payments: customer sees payments on their bookings; admin/finance see all.
create policy "payments: customer sees own" on public.payments
  for select using (
    exists (select 1 from public.bookings b where b.id = booking_id and b.customer_id = auth.uid())
  );
create policy "payments: admin and finance see all" on public.payments
  for select using (public.current_role() in ('admin', 'finance'));

-- payouts: shop owner sees their shop's; admin/finance see all.
create policy "payouts: owner sees own shop" on public.payouts
  for select using (shop_id is not null and public.is_shop_owner(shop_id));
create policy "payouts: admin and finance see all" on public.payouts
  for select using (public.current_role() in ('admin', 'finance'));

-- ledger: admin/finance see all; shop owner sees entries for their shop's bookings.
create policy "ledger: admin and finance see all" on public.ledger_entries
  for select using (public.current_role() in ('admin', 'finance'));
create policy "ledger: owner sees own shop entries" on public.ledger_entries
  for select using (
    booking_id is not null and exists (
      select 1 from public.bookings b
      where b.id = booking_id and public.is_shop_owner(b.shop_id)
    )
  );

-- disputes: the customer who raised it sees it; admin sees all.
create policy "disputes: raiser sees own" on public.disputes
  for select using (raised_by = auth.uid());
create policy "disputes: admin sees all" on public.disputes
  for all using (public.current_role() = 'admin');

-- reviews: public reads; customers write their own (one per booking).
create policy "reviews: public reads" on public.reviews
  for select using (true);
create policy "reviews: customer writes own" on public.reviews
  for insert with check (customer_id = auth.uid());
create policy "reviews: admin manages all" on public.reviews
  for all using (public.current_role() = 'admin');
