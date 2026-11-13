// Server actions — Finance (pay in / pay out), disputes resolution,
// reviews, and Admin database management.
//
// Pay-out workflow: Requested → Approved → Paid. A pay-out is only booked
// in the ledger when it is marked Paid — never before.

'use server';

import { revalidatePath } from 'next/cache';
import { getServiceSupabase } from './supabase';
import { getCurrentProfile, requireRole, requireShopOwner } from './auth';
import { settleDisputedNoShowForCustomer, settleNoShow } from './settlement';
import type { PayoutType } from './types';

type ActionResult = { ok: boolean; error?: string; id?: string };

async function ledger(
  bookingId: string | null,
  type: string,
  amount: number,
  description: string,
) {
  const supabase = getServiceSupabase();
  await supabase.from('ledger_entries').insert({ booking_id: bookingId, type, amount, description });
}

/** Barber's available payable balance: settled earnings minus payouts already paid. */
export async function barberPayableBalance(shopId: string): Promise<number> {
  const supabase = getServiceSupabase();
  const { data: entries } = await supabase
    .from('ledger_entries')
    .select('type, amount, booking_id')
    .in('type', ['barber_payable', 'waiting_compensation']);
  const { data: bookings } = await supabase.from('bookings').select('id').eq('shop_id', shopId);
  const bookingIds = new Set((bookings ?? []).map((b) => b.id));
  let earned = 0;
  for (const e of entries ?? []) {
    if (e.booking_id && bookingIds.has(e.booking_id)) earned += e.amount;
  }
  const { data: paid } = await supabase
    .from('payouts')
    .select('amount')
    .eq('shop_id', shopId)
    .eq('type', 'barber_payout')
    .eq('status', 'paid');
  const paidOut = (paid ?? []).reduce((sum, p) => sum + p.amount, 0);
  return earned - paidOut;
}

export async function requestPayout(form: {
  shopId: string;
  type: PayoutType;
  amount: number;
  bookingId?: string | null;
}): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: 'Not signed in.' };
  if (form.type === 'barber_payout') {
    await requireShopOwner(form.shopId);
    const balance = await barberPayableBalance(form.shopId);
    if (form.amount > balance) {
      return { ok: false, error: `Requested amount exceeds the payable balance (Rs ${balance}).` };
    }
    // The same balance cannot be paid out twice: one open request at a time.
    const supabase = getServiceSupabase();
    const { data: open } = await supabase
      .from('payouts')
      .select('id')
      .eq('shop_id', form.shopId)
      .eq('type', 'barber_payout')
      .in('status', ['requested', 'approved'])
      .limit(1);
    if (open && open.length > 0) {
      return { ok: false, error: 'A payout request for this shop is already open.' };
    }
  } else {
    await requireRole(['admin', 'finance']);
  }
  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from('payouts')
    .insert({
      shop_id: form.shopId,
      booking_id: form.bookingId || null,
      type: form.type,
      amount: Math.round(form.amount),
      status: 'requested',
      requested_by: profile.id,
    })
    .select('id')
    .single();
  if (error) return { ok: false, error: error.message };
  revalidatePath('/finance');
  return { ok: true, id: data.id };
}

export async function approvePayout(payoutId: string): Promise<ActionResult> {
  await requireRole(['admin', 'finance']);
  const supabase = getServiceSupabase();
  const { data: payout } = await supabase.from('payouts').select('*').eq('id', payoutId).single();
  if (!payout) return { ok: false, error: 'Payout not found.' };
  if (payout.status !== 'requested') {
    return { ok: false, error: `Only a requested payout can be approved (now: ${payout.status}).` };
  }
  // Settlement is held while a dispute is unresolved.
  if (payout.booking_id) {
    const { data: dispute } = await supabase
      .from('disputes')
      .select('id')
      .eq('booking_id', payout.booking_id)
      .eq('status', 'open')
      .limit(1);
    if (dispute && dispute.length > 0) {
      return { ok: false, error: 'Settlement is held — an open dispute must be resolved first.' };
    }
  }
  const { error } = await supabase.from('payouts').update({ status: 'approved' }).eq('id', payoutId);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/finance');
  return { ok: true };
}

export async function markPayoutPaid(payoutId: string): Promise<ActionResult> {
  await requireRole(['admin', 'finance']);
  const supabase = getServiceSupabase();
  const { data: payout } = await supabase.from('payouts').select('*').eq('id', payoutId).single();
  if (!payout) return { ok: false, error: 'Payout not found.' };
  if (payout.status !== 'approved') {
    return { ok: false, error: `Only an approved payout can be marked paid (now: ${payout.status}).` };
  }
  const { error } = await supabase.from('payouts').update({ status: 'paid' }).eq('id', payoutId);
  if (error) return { ok: false, error: error.message };
  // Booked in the ledger only now that the money has actually been sent.
  await ledger(
    payout.booking_id,
    'payout',
    -payout.amount,
    payout.type === 'refund' ? `Refund sent to customer (Rs ${payout.amount})` : `Payout sent to barber (Rs ${payout.amount})`,
  );
  if (payout.booking_id) {
    await supabase.from('bookings').update({ status: 'settled' }).eq('id', payout.booking_id);
  }
  revalidatePath('/finance');
  revalidatePath('/bookings');
  return { ok: true };
}

// ── Dispute resolution (Admin) ─────────────────────────────────────────

export async function resolveDispute(
  disputeId: string,
  outcome: 'customer' | 'barber',
  note: string,
): Promise<ActionResult> {
  await requireRole(['admin']);
  const supabase = getServiceSupabase();
  const { data: dispute } = await supabase.from('disputes').select('*').eq('id', disputeId).single();
  if (!dispute) return { ok: false, error: 'Dispute not found.' };
  if (dispute.status !== 'open') return { ok: false, error: 'This dispute is already resolved.' };
  const { data: booking } = await supabase.from('bookings').select('*').eq('id', dispute.booking_id).single();
  if (!booking) return { ok: false, error: 'Booking not found.' };

  const newStatus = outcome === 'customer' ? 'resolved_customer' : 'resolved_barber';
  const { error } = await supabase
    .from('disputes')
    .update({ status: newStatus, resolution_note: note || null })
    .eq('id', disputeId);
  if (error) return { ok: false, error: error.message };

  if (outcome === 'customer') {
    // Full refund: the customer gets 100% back. Reverse the no-show split
    // that was already ledgered (waiting compensation + commission) and
    // replace the 80% refund request with a 100% one.
    const full = settleDisputedNoShowForCustomer(booking.amount);
    const split = settleNoShow(booking.amount);
    await ledger(booking.id, 'waiting_compensation', -split.barberWaiting, 'Reversed — dispute resolved for customer');
    await ledger(booking.id, 'commission', -split.platform, 'Reversed — dispute resolved for customer');
    await supabase.from('payouts').delete().eq('booking_id', booking.id).eq('type', 'refund').eq('status', 'requested');
    await supabase.from('payouts').insert({
      shop_id: booking.shop_id,
      booking_id: booking.id,
      type: 'refund',
      amount: full.customerRefund,
      status: 'requested',
      requested_by: dispute.raised_by,
    });
    await supabase.from('bookings').update({ status: 'refund_pending' }).eq('id', booking.id);
  }
  // outcome 'barber': the original 10/10/80 no-show split stands.
  revalidatePath('/admin');
  revalidatePath('/finance');
  revalidatePath('/bookings');
  return { ok: true };
}

// ── Reviews ────────────────────────────────────────────────────────────

export async function addReview(
  bookingId: string,
  rating: number,
  comment: string,
): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: 'Not signed in.' };
  if (rating < 1 || rating > 5) return { ok: false, error: 'Rating must be 1–5 stars.' };
  const supabase = getServiceSupabase();
  const { data: booking } = await supabase.from('bookings').select('*').eq('id', bookingId).single();
  if (!booking) return { ok: false, error: 'Booking not found.' };
  if (booking.customer_id !== profile.id) return { ok: false, error: 'This is not your booking.' };
  if (!['completed', 'settled'].includes(booking.status)) {
    return { ok: false, error: 'You can only review a completed booking.' };
  }
  // One review per completed booking (also enforced by a DB unique constraint).
  const { data, error } = await supabase
    .from('reviews')
    .insert({ booking_id: bookingId, shop_id: booking.shop_id, customer_id: profile.id, rating, comment: comment || null })
    .select('id')
    .single();
  if (error) return { ok: false, error: error.message };
  revalidatePath('/bookings');
  return { ok: true, id: data.id };
}

// ── Admin: shops, reviews, full database browser ───────────────────────

export async function setShopStatus(
  shopId: string,
  status: 'approved' | 'suspended' | 'rejected',
): Promise<ActionResult> {
  await requireRole(['admin']);
  const supabase = getServiceSupabase();
  const { error } = await supabase.from('shops').update({ status }).eq('id', shopId);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/admin');
  return { ok: true };
}

export async function deleteShop(shopId: string): Promise<ActionResult> {
  await requireRole(['admin']);
  const supabase = getServiceSupabase();
  const { data: bookings } = await supabase.from('bookings').select('id').eq('shop_id', shopId).limit(1);
  if (bookings && bookings.length > 0) {
    return { ok: false, error: 'Cannot delete a shop that has bookings. Suspend it instead.' };
  }
  const { error } = await supabase.from('shops').delete().eq('id', shopId);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/admin');
  return { ok: true };
}

export async function deleteReview(reviewId: string): Promise<ActionResult> {
  await requireRole(['admin']);
  const supabase = getServiceSupabase();
  const { error } = await supabase.from('reviews').delete().eq('id', reviewId);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/admin');
  return { ok: true };
}

export type DatabaseSnapshot = Record<string, Record<string, unknown>[]>;

/** Full database browser for the Admin panel — every table, every row. */
export async function getDatabaseSnapshot(): Promise<DatabaseSnapshot> {
  await requireRole(['admin']);
  const supabase = getServiceSupabase();
  const tables = [
    'profiles',
    'shops',
    'services',
    'barbers',
    'bookings',
    'payments',
    'payouts',
    'ledger_entries',
    'disputes',
    'reviews',
  ] as const;
  const snapshot: DatabaseSnapshot = {};
  for (const table of tables) {
    const { data, error } = await supabase.from(table).select('*').order('created_at', { ascending: false }).limit(500);
    snapshot[table] = error ? [] : ((data ?? []) as Record<string, unknown>[]);
  }
  return snapshot;
}
