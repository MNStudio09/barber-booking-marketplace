-- Seed file — INTENTIONALLY EMPTY.
--
-- The live database starts EMPTY by design: no sample shops, no sample
-- customers, no sample bookings. The first real shop registers through the
-- Barber Panel and is approved by an Admin before customers can book it.
--
-- If you want demo data for local testing only, uncomment the block below
-- AFTER creating a test user, and never run it against the live database.
-- (Replace the placeholder UUIDs with real profile/shop ids.)

-- -- Demo data (LOCAL TESTING ONLY — keep commented out for production) --
-- insert into public.shops (id, owner_id, name, area, city, address, status, opening_time, closing_time)
-- values ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000',
--         'Demo Barber Shop', 'Demo Area', 'Your City', '1 Demo Street', 'approved', '09:00', '21:00');
-- insert into public.services (shop_id, name, price, duration_minutes)
-- values ('00000000-0000-0000-0000-000000000001', 'Haircut', 1000, 30);

select 'seed: nothing seeded — live database starts empty by design' as note;
