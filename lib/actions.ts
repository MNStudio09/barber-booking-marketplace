// Server actions — shop management + the booking flow.
// Every mutation goes through here so the settlement rules and the
// 15-minute check-in window are enforced on the server, not the client.
//
// Flow: request → barber accept/reject → payment link → customer pays in
// advance (SIMULATED) → payment verified → confirmed (+ 4-digit OTP) →
// check-in within 15 minutes → Start Work → End Work → settlement.

'use server';

import { revalidatePath } from 'next/cache';
import { getServiceSupabase } from './supabase';
import { getCurrentProfile, requireRole, requireShopOwner } from './auth';
import { generateOtp, settleCompleted, settleNoShow } from './settlement';
import { simulatePayment } from './payments';
import { slotsForHours } from './geo';
import { CHECK_IN_WINDOW_MINUTES } from './config';
import type { PaymentMethod } from './types';

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

// ── Shop registration & management ─────────────────────────────────────

export async function registerShop(form: {
  name: string;
  area: string;
  city: string;
  address: string;
  phone: string;
  description: string;
  openingTime: string;
  closingTime: string;
  lat?: number | null;
  lng?: number | null;
}): Promise<ActionResult> {
  const profile = await requireRole(['customer', 'barber', 'admin']);
  const supabase = getServiceSupabase();
  // Registering a shop makes a customer a barber.
  if (profile.role === 'customer') {
    await supabase.from('profiles').update({ role: 'barber' }).eq('id', profile.id);
  }
  const { data, error } = await supabase
    .from('shops')
    .insert({
      owner_id: profile.id,
      name: form.name,
      area: form.area,
      city: form.city,
      address: form.address,
      phone: form.phone || null,
      description: form.description || null,
      opening_time: form.openingTime,
      closing_time: form.closingTime,
      lat: form.lat ?? null,
      lng: form.lng ?? null,
      status: 'pending', // new shops stay pending until an admin approves them
    })
    .select('id')
    .single();
  if (error) return { ok: false, error: error.message };
  revalidatePath('/barber');
  revalidatePath('/admin');
  return { ok: true, id: data.id };
}

export async function updateShopHours(
  shopId: string,
  openingTime: string,
  closingTime: string,
): Promise<ActionResult> {
  await requireShopOwner(shopId);
  const supabase = getServiceSupabase();
  const { error } = await supabase
    .from('shops')
    .update({ opening_time: openingTime, closing_time: closingTime })
    .eq('id', shopId);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/barber');
  return { ok: true };
}

export async function addService(
  shopId: string,
  form: { name: string; price: number; durationMinutes: number; description: string },
): Promise<ActionResult> {
  await requireShopOwner(shopId);
  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from('services')
    .insert({
      shop_id: shopId,
      name: form.name,
      price: Math.round(form.price),
      duration_minutes: form.durationMinutes,
      description: form.description || null,
    })
    .select('id')
    .single();
  if (error) return { ok: false, error: error.message };
  revalidatePath('/barber');
  return { ok: true, id: data.id };
}

export async function deleteService(serviceId: string, shopId: string): Promise<ActionResult> {
  await requireShopOwner(shopId);
  const supabase = getServiceSupabase();
  const { error } = await supabase.from('services').delete().eq('id', serviceId);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/barber');
  return { ok: true };
}

export async function addBarber(
  shopId: string,
  form: { name: string; phone: string; specialty: string },
): Promise<ActionResult> {
  await requireShopOwner(shopId);
  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from('barbers')
    .insert({ shop_id: shopId, name: form.name, phone: form.phone || null, specialty: form.specialty || null })
    .select('id')
    .single();
  if (error) return { ok: false, error: error.message };
  revalidatePath('/barber');
  return { ok: true, id: data.id };
}

export async function setBarberActive(barberId: string, shopId: string, active: boolean): Promise<ActionResult> {
  await requireShopOwner(shopId);
  const supabase = getServiceSupabase();
  const { error } = await supabase.from('barbers').update({ active }).eq('id', barberId);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/barber');
  return { ok: true };
}

// ── Booking flow ───────────────────────────────────────────────────────

export async function createBooking(form: {
  shopId: string;
  serviceId: string;
  barberId?: string | null;
  date: string;
  timeSlot: string;
  notes: string;
}): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: 'Please sign in to book.' };
  const supabase = getServiceSupabase();

  const { data: shop } = await supabase.from('shops').select('*').eq('id', form.shopId).single();
  if (!shop || shop.status !== 'approved') {
    return { ok: false, error: 'This shop is not accepting bookings yet.' };
  }
  const { data: service } = await supabase.from('services').select('*').eq('id', form.serviceId).single();
  if (!service || service.shop_id !== form.shopId) {
    return { ok: false, error: 'Service not found for this shop.' };
  }
  // Slots are offered only inside opening hours and must fit the service.
  const valid = slotsForHours(shop.opening_time, shop.closing_time, service.duration_minutes);
  if (!valid.includes(form.timeSlot)) {
    return { ok: false, error: 'That time slot is outside the shop opening hours.' };
  }
  // No double booking: same shop + date + slot already taken.
  const { data: clash } = await supabase
    .from('bookings')
    .select('id')
    .eq('shop_id', form.shopId)
    .eq('date', form.date)
    .eq('time_slot', form.timeSlot)
    .not('status', 'in', '("cancelled","rejected","no_show")')
    .limit(1);
  if (clash && clash.length > 0) {
    return { ok: false, error: 'That time slot is already booked. Please pick another.' };
  }

  const { data, error } = await supabase
    .from('bookings')
    .insert({
      shop_id: form.shopId,
      service_id: form.serviceId,
      barber_id: form.barberId || null,
      customer_id: profile.id,
      date: form.date,
      time_slot: form.timeSlot,
      notes: form.notes || null,
      status: 'requested',
      amount: service.price,
    })
    .select('id')
    .single();
  if (error) return { ok: false, error: error.message };
  revalidatePath('/bookings');
  revalidatePath('/barber');
  return { ok: true, id: data.id };
}

export async function respondBooking(bookingId: string, accept: boolean): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: 'Not signed in.' };
  const supabase = getServiceSupabase();
  const { data: booking } = await supabase.from('bookings').select('*').eq('id', bookingId).single();
  if (!booking) return { ok: false, error: 'Booking not found.' };
  await requireShopOwner(booking.shop_id);
  if (booking.status !== 'requested') {
    return { ok: false, error: `Only a requested booking can be answered (now: ${booking.status}).` };
  }
  const { error } = await supabase
    .from('bookings')
    .update({ status: accept ? 'awaiting_payment' : 'rejected' })
    .eq('id', bookingId);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/barber');
  revalidatePath('/bookings');
  return { ok: true };
}

export async function payBooking(bookingId: string, method: PaymentMethod): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: 'Not signed in.' };
  const supabase = getServiceSupabase();
  const { data: booking } = await supabase.from('bookings').select('*').eq('id', bookingId).single();
  if (!booking) return { ok: false, error: 'Booking not found.' };
  if (booking.customer_id !== profile.id) return { ok: false, error: 'This is not your booking.' };
  if (booking.status !== 'awaiting_payment') {
    return { ok: false, error: `This booking is not awaiting payment (now: ${booking.status}).` };
  }

  // SIMULATED payment — no real money moves. See lib/payments.ts.
  const result = await simulatePayment(booking.amount, method);
  const { error: payError } = await supabase.from('payments').insert({
    booking_id: bookingId,
    amount: booking.amount,
    method,
    status: 'simulated',
    simulated: true,
    reference: result.reference,
  });
  if (payError) return { ok: false, error: payError.message };

  // Payment verified instantly in the simulation → booking confirmed.
  const otp = generateOtp();
  const { error } = await supabase
    .from('bookings')
    .update({ status: 'confirmed', otp_code: otp })
    .eq('id', bookingId);
  if (error) return { ok: false, error: error.message };
  await ledger(bookingId, 'payment_received', booking.amount, `Advance payment received (simulated, ${method})`);
  revalidatePath('/bookings');
  revalidatePath('/finance');
  return { ok: true };
}

export async function cancelBooking(bookingId: string): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: 'Not signed in.' };
  const supabase = getServiceSupabase();
  const { data: booking } = await supabase.from('bookings').select('*').eq('id', bookingId).single();
  if (!booking) return { ok: false, error: 'Booking not found.' };
  if (booking.customer_id !== profile.id) return { ok: false, error: 'This is not your booking.' };
  if (!['requested', 'awaiting_payment'].includes(booking.status)) {
    return { ok: false, error: 'Only an unconfirmed booking can be cancelled here.' };
  }
  const { error } = await supabase.from('bookings').update({ status: 'cancelled' }).eq('id', bookingId);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/bookings');
  return { ok: true };
}

// ── Check-in, work, no-show ────────────────────────────────────────────

function slotStart(booking: { date: string; time_slot: string }): Date {
  return new Date(`${booking.date}T${booking.time_slot}:00`);
}

export async function checkIn(
  bookingId: string,
  method: 'arrived' | 'otp',
  otp?: string,
): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: 'Not signed in.' };
  const supabase = getServiceSupabase();
  const { data: booking } = await supabase.from('bookings').select('*').eq('id', bookingId).single();
  if (!booking) return { ok: false, error: 'Booking not found.' };
  if (booking.customer_id !== profile.id) return { ok: false, error: 'This is not your booking.' };
  if (booking.status !== 'confirmed') {
    return { ok: false, error: `Only a confirmed booking can be checked in (now: ${booking.status}).` };
  }
  if (booking.checked_in_at) return { ok: false, error: 'Already checked in.' };
  if (method === 'otp' && (!otp || otp !== booking.otp_code)) {
    return { ok: false, error: 'Wrong 4-digit code. Please check the code on your booking.' };
  }
  const start = slotStart(booking);
  const now = new Date();
  const earliest = new Date(start.getTime() - CHECK_IN_WINDOW_MINUTES * 60_000);
  const latest = new Date(start.getTime() + CHECK_IN_WINDOW_MINUTES * 60_000);
  if (now < earliest || now > latest) {
    return { ok: false, error: 'Check-in is open from 15 minutes before to 15 minutes after your slot.' };
  }
  const { error } = await supabase
    .from('bookings')
    .update({ checked_in_at: now.toISOString() })
    .eq('id', bookingId);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/bookings');
  revalidatePath('/barber');
  return { ok: true };
}

export async function startWork(bookingId: string): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: 'Not signed in.' };
  const supabase = getServiceSupabase();
  const { data: booking } = await supabase.from('bookings').select('*').eq('id', bookingId).single();
  if (!booking) return { ok: false, error: 'Booking not found.' };
  await requireShopOwner(booking.shop_id);
  if (booking.status !== 'confirmed' || !booking.checked_in_at) {
    return { ok: false, error: 'Work can only start after the customer has checked in.' };
  }
  const { error } = await supabase.from('bookings').update({ status: 'in_progress' }).eq('id', bookingId);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/barber');
  revalidatePath('/bookings');
  return { ok: true };
}

export async function endWork(bookingId: string): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: 'Not signed in.' };
  const supabase = getServiceSupabase();
  const { data: booking } = await supabase.from('bookings').select('*').eq('id', bookingId).single();
  if (!booking) return { ok: false, error: 'Booking not found.' };
  await requireShopOwner(booking.shop_id);
  if (booking.status !== 'in_progress') {
    return { ok: false, error: `Only a booking in progress can be finished (now: ${booking.status}).` };
  }
  const split = settleCompleted(booking.amount);
  const { error } = await supabase
    .from('bookings')
    .update({ status: 'settled' })
    .eq('id', bookingId);
  if (error) return { ok: false, error: error.message };
  // Settlement ledger: commission to the platform, the rest payable to the barber.
  await ledger(bookingId, 'commission', split.platform, `Platform commission 10% on Rs ${booking.amount}`);
  await ledger(bookingId, 'barber_payable', split.barber, `Barber payable 90% on Rs ${booking.amount}`);
  revalidatePath('/barber');
  revalidatePath('/bookings');
  revalidatePath('/finance');
  return { ok: true };
}

export async function markNoShow(bookingId: string): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: 'Not signed in.' };
  const supabase = getServiceSupabase();
  const { data: booking } = await supabase.from('bookings').select('*').eq('id', bookingId).single();
  if (!booking) return { ok: false, error: 'Booking not found.' };
  await requireShopOwner(booking.shop_id);
  // A barber must NOT be able to no-show a checked-in customer.
  if (booking.checked_in_at) {
    return { ok: false, error: 'This customer already checked in — you cannot mark them as a no-show.' };
  }
  if (booking.status !== 'confirmed') {
    return { ok: false, error: `Only a confirmed booking can be marked as no-show (now: ${booking.status}).` };
  }
  const deadline = new Date(slotStart(booking).getTime() + CHECK_IN_WINDOW_MINUTES * 60_000);
  if (new Date() < deadline) {
    return { ok: false, error: 'Please wait until the 15-minute check-in window has passed.' };
  }
  const split = settleNoShow(booking.amount);
  const { error } = await supabase
    .from('bookings')
    .update({ status: 'refund_pending' })
    .eq('id', bookingId);
  if (error) return { ok: false, error: error.message };
  await ledger(bookingId, 'waiting_compensation', split.barberWaiting, 'Barber waiting compensation 10% (no-show)');
  await ledger(bookingId, 'commission', split.platform, 'Platform commission 10% (no-show)');
  // The customer's 80% is requested as a refund pay-out (approved/paid by Finance).
  await supabase.from('payouts').insert({
    shop_id: booking.shop_id,
    booking_id: bookingId,
    type: 'refund',
    amount: split.customerRefund,
    status: 'requested',
    requested_by: profile.id,
  });
  revalidatePath('/barber');
  revalidatePath('/bookings');
  revalidatePath('/finance');
  return { ok: true };
}

// ── Disputes (raised by the customer) ───────────────────────────────────

export async function raiseDispute(bookingId: string, reason: string): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: 'Not signed in.' };
  const supabase = getServiceSupabase();
  const { data: booking } = await supabase.from('bookings').select('*').eq('id', bookingId).single();
  if (!booking) return { ok: false, error: 'Booking not found.' };
  if (booking.customer_id !== profile.id) return { ok: false, error: 'This is not your booking.' };
  if (!['no_show', 'refund_pending'].includes(booking.status)) {
    return { ok: false, error: 'Disputes can only be raised on a no-show booking.' };
  }
  if (booking.dispute_id) return { ok: false, error: 'A dispute is already open for this booking.' };
  const { data, error } = await supabase
    .from('disputes')
    .insert({ booking_id: bookingId, raised_by: profile.id, reason, status: 'open' })
    .select('id')
    .single();
  if (error) return { ok: false, error: error.message };
  await supabase.from('bookings').update({ dispute_id: data.id }).eq('id', bookingId);
  revalidatePath('/bookings');
  revalidatePath('/admin');
  return { ok: true, id: data.id };
}
