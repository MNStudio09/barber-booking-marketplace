// Read helpers for client components (browser client, RLS-protected).
// Admin / Finance cross-shop reads are allowed by the RLS policies in
// supabase/migrations/0001_init.sql for the admin and finance roles.

import { getBrowserSupabase } from './supabase';
import { distanceKm } from './geo';
import type { Booking, BookingWithMeta, LedgerEntry, Payout, Payment, Profile, Review, Service, Shop, ShopWithMeta } from './types';

export async function listApprovedShops(): Promise<ShopWithMeta[]> {
  const supabase = getBrowserSupabase();
  const { data: shops } = await supabase
    .from('shops')
    .select('*')
    .eq('status', 'approved')
    .order('created_at', { ascending: false });
  const result: ShopWithMeta[] = [];
  for (const shop of (shops ?? []) as Shop[]) {
    const [{ data: services }, { data: barbers }, { data: reviews }] = await Promise.all([
      supabase.from('services').select('*').eq('shop_id', shop.id),
      supabase.from('barbers').select('*').eq('shop_id', shop.id).eq('active', true),
      supabase.from('reviews').select('rating').eq('shop_id', shop.id),
    ]);
    const ratings = (reviews ?? []) as { rating: number }[];
    result.push({
      ...shop,
      services: (services ?? []) as Service[],
      barbers: (barbers ?? []) as never,
      rating_avg: ratings.length ? ratings.reduce((a, r) => a + r.rating, 0) / ratings.length : null,
      rating_count: ratings.length,
      distance_km: null,
    });
  }
  return result;
}

export async function getShop(id: string): Promise<ShopWithMeta | null> {
  const supabase = getBrowserSupabase();
  const { data: shop } = await supabase.from('shops').select('*').eq('id', id).single();
  if (!shop) return null;
  const [{ data: services }, { data: barbers }, { data: reviews }] = await Promise.all([
    supabase.from('services').select('*').eq('shop_id', id),
    supabase.from('barbers').select('*').eq('shop_id', id).eq('active', true),
    supabase.from('reviews').select('rating, comment, customer_id, created_at').eq('shop_id', id).order('created_at', { ascending: false }),
  ]);
  const ratings = (reviews ?? []) as { rating: number }[];
  return {
    ...(shop as Shop),
    services: (services ?? []) as Service[],
    barbers: (barbers ?? []) as never,
    rating_avg: ratings.length ? ratings.reduce((a, r) => a + r.rating, 0) / ratings.length : null,
    rating_count: ratings.length,
    distance_km: null,
  };
}

export async function getShopReviews(shopId: string): Promise<Review[]> {
  const supabase = getBrowserSupabase();
  const { data } = await supabase
    .from('reviews')
    .select('*')
    .eq('shop_id', shopId)
    .order('created_at', { ascending: false });
  return (data ?? []) as Review[];
}

/** Shops sorted nearest-first around a point (distance computed client-side). */
export function sortNearestFirst(shops: ShopWithMeta[], lat: number, lng: number): ShopWithMeta[] {
  return shops
    .map((s) => ({
      ...s,
      distance_km: s.lat != null && s.lng != null ? distanceKm({ lat, lng }, { lat: s.lat, lng: s.lng }) : null,
    }))
    .sort((a, b) => (a.distance_km ?? Infinity) - (b.distance_km ?? Infinity));
}

export async function listMyBookings(customerId: string): Promise<BookingWithMeta[]> {
  const supabase = getBrowserSupabase();
  const { data } = await supabase
    .from('bookings')
    .select('*')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false });
  const bookings = (data ?? []) as Booking[];
  const out: BookingWithMeta[] = [];
  for (const b of bookings) {
    const [{ data: shop }, { data: service }, { data: profile }] = await Promise.all([
      supabase.from('shops').select('name').eq('id', b.shop_id).single(),
      supabase.from('services').select('name').eq('id', b.service_id).single(),
      supabase.from('profiles').select('full_name').eq('id', b.customer_id).single(),
    ]);
    out.push({
      ...b,
      shop_name: (shop as { name: string } | null)?.name ?? '—',
      service_name: (service as { name: string } | null)?.name ?? '—',
      customer_name: (profile as { full_name: string | null } | null)?.full_name ?? null,
    });
  }
  return out;
}

export async function listShopBookings(shopId: string): Promise<BookingWithMeta[]> {
  const supabase = getBrowserSupabase();
  const { data } = await supabase
    .from('bookings')
    .select('*')
    .eq('shop_id', shopId)
    .order('created_at', { ascending: false });
  const bookings = (data ?? []) as Booking[];
  const out: BookingWithMeta[] = [];
  for (const b of bookings) {
    const [{ data: shop }, { data: service }, { data: profile }] = await Promise.all([
      supabase.from('shops').select('name').eq('id', b.shop_id).single(),
      supabase.from('services').select('name').eq('id', b.service_id).single(),
      supabase.from('profiles').select('full_name').eq('id', b.customer_id).single(),
    ]);
    out.push({
      ...b,
      shop_name: (shop as { name: string } | null)?.name ?? '—',
      service_name: (service as { name: string } | null)?.name ?? '—',
      customer_name: (profile as { full_name: string | null } | null)?.full_name ?? null,
    });
  }
  return out;
}

export async function listPayments(): Promise<Payment[]> {
  const supabase = getBrowserSupabase();
  const { data } = await supabase.from('payments').select('*').order('created_at', { ascending: false });
  return (data ?? []) as Payment[];
}

export async function listPayouts(): Promise<Payout[]> {
  const supabase = getBrowserSupabase();
  const { data } = await supabase.from('payouts').select('*').order('created_at', { ascending: false });
  return (data ?? []) as Payout[];
}

export async function listLedger(): Promise<LedgerEntry[]> {
  const supabase = getBrowserSupabase();
  const { data } = await supabase.from('ledger_entries').select('*').order('created_at', { ascending: false });
  return (data ?? []) as LedgerEntry[];
}

export async function listProfiles(): Promise<Profile[]> {
  const supabase = getBrowserSupabase();
  const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
  return (data ?? []) as Profile[];
}

export async function listAllShops(): Promise<Shop[]> {
  const supabase = getBrowserSupabase();
  const { data } = await supabase.from('shops').select('*').order('created_at', { ascending: false });
  return (data ?? []) as Shop[];
}

export async function listAllBookings(): Promise<BookingWithMeta[]> {
  const supabase = getBrowserSupabase();
  const { data } = await supabase.from('bookings').select('*').order('created_at', { ascending: false });
  const bookings = (data ?? []) as Booking[];
  const out: BookingWithMeta[] = [];
  for (const b of bookings) {
    const [{ data: shop }, { data: service }, { data: profile }] = await Promise.all([
      supabase.from('shops').select('name').eq('id', b.shop_id).single(),
      supabase.from('services').select('name').eq('id', b.service_id).single(),
      supabase.from('profiles').select('full_name').eq('id', b.customer_id).single(),
    ]);
    out.push({
      ...b,
      shop_name: (shop as { name: string } | null)?.name ?? '—',
      service_name: (service as { name: string } | null)?.name ?? '—',
      customer_name: (profile as { full_name: string | null } | null)?.full_name ?? null,
    });
  }
  return out;
}
