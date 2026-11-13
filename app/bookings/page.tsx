'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { cancelBooking, checkIn, payBooking, raiseDispute } from '@/lib/actions';
import { addReview } from '@/lib/actions-finance';
import { listMyBookings } from '@/lib/data';
import { PAYMENT_METHODS } from '@/lib/payments';
import { useProfile } from '@/lib/use-profile';
import type { BookingWithMeta, PaymentMethod } from '@/lib/types';
import { Badge, Button, Card, EmptyState, Field, Input, SectionTitle, Select, StatusBadge, Textarea, fmt } from '@/components/ui';

function BookingCard({ booking, onChange }: { booking: BookingWithMeta; onChange: () => void }) {
  const [method, setMethod] = useState<PaymentMethod>('jazzcash');
  const [otp, setOtp] = useState('');
  const [disputeReason, setDisputeReason] = useState('');
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function run(fn: () => Promise<{ ok: boolean; error?: string }>, success: string) {
    setBusy(true);
    setMessage('');
    const res = await fn();
    setBusy(false);
    setMessage(res.ok ? success : res.error ?? 'Something went wrong.');
    if (res.ok) onChange();
  }

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="font-bold text-charcoal-900">{booking.shop_name}</h3>
          <p className="text-sm text-charcoal-500">
            {booking.service_name} · {booking.date} at {booking.time_slot}
          </p>
          <p className="text-sm font-semibold text-charcoal-800">{fmt(booking.amount)}</p>
        </div>
        <StatusBadge status={booking.status} />
      </div>
      {booking.notes ? <p className="mt-2 text-sm text-charcoal-600">Notes: {booking.notes}</p> : null}
      {booking.status === 'confirmed' && booking.otp_code ? (
        <p className="mt-2 rounded-xl bg-beige-100 px-3 py-2 text-sm">
          Your check-in code: <strong className="tracking-widest">{booking.otp_code}</strong> — show it at the shop
          or use it below. Check in from 15 minutes before to 15 minutes after your slot.
        </p>
      ) : null}
      {booking.checked_in_at ? (
        <p className="mt-2 text-sm text-green-700">✓ Checked in at {new Date(booking.checked_in_at).toLocaleTimeString()}</p>
      ) : null}
      {booking.dispute_id ? <p className="mt-2"><Badge tone="amber">Dispute open</Badge></p> : null}

      <div className="mt-4 flex flex-wrap gap-2">
        {booking.status === 'awaiting_payment' ? (
          <>
            <Select value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)} className="w-44">
              {PAYMENT_METHODS.map((m) => (
                <option key={m.id} value={m.id}>{m.label}</option>
              ))}
            </Select>
            <Button
              disabled={busy}
              onClick={() => run(() => payBooking(booking.id, method), 'Payment done (simulated) — booking confirmed! Your check-in code is shown above.')}
            >
              Pay {fmt(booking.amount)} (Simulated)
            </Button>
          </>
        ) : null}
        {booking.status === 'confirmed' && !booking.checked_in_at ? (
          <>
            <Button disabled={busy} onClick={() => run(() => checkIn(booking.id, 'arrived'), 'Checked in — enjoy your appointment!')}>
              I Have Arrived
            </Button>
            <Input
              placeholder="4-digit code"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              className="w-32"
              maxLength={4}
            />
            <Button variant="outline" disabled={busy || otp.length !== 4} onClick={() => run(() => checkIn(booking.id, 'otp', otp), 'Checked in with code!')}>
              Check in with code
            </Button>
          </>
        ) : null}
        {['requested', 'awaiting_payment'].includes(booking.status) ? (
          <Button variant="ghost" disabled={busy} onClick={() => run(() => cancelBooking(booking.id), 'Booking cancelled.')}>
            Cancel
          </Button>
        ) : null}
      </div>

      {['no_show', 'refund_pending'].includes(booking.status) && !booking.dispute_id ? (
        <div className="mt-4 space-y-2 border-t border-beige-200 pt-4">
          <p className="text-sm font-semibold text-charcoal-800">Disagree with the no-show? Raise a dispute — settlement is held until it is resolved.</p>
          <Textarea rows={2} value={disputeReason} onChange={(e) => setDisputeReason(e.target.value)} placeholder="What happened? e.g. I arrived on time but the shop was closed." />
          <Button
            variant="outline"
            disabled={busy || !disputeReason.trim()}
            onClick={() => run(() => raiseDispute(booking.id, disputeReason), 'Dispute raised. An admin will review it.')}
          >
            Raise dispute
          </Button>
        </div>
      ) : null}

      {['completed', 'settled'].includes(booking.status) ? (
        <div className="mt-4 space-y-2 border-t border-beige-200 pt-4">
          <p className="text-sm font-semibold text-charcoal-800">Rate this visit (one review per booking)</p>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={rating} onChange={(e) => setRating(Number(e.target.value))} className="w-28">
              {[5, 4, 3, 2, 1].map((r) => (
                <option key={r} value={r}>{r} star{r === 1 ? '' : 's'}</option>
              ))}
            </Select>
            <Input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="How was it?" className="flex-1" />
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => run(() => addReview(booking.id, rating, comment), 'Thanks — review saved.')}
            >
              Submit review
            </Button>
          </div>
        </div>
      ) : null}

      {message ? <p className="mt-3 text-sm text-charcoal-700">{message}</p> : null}
    </Card>
  );
}

export default function MyBookingsPage() {
  const { userId, loading: profileLoading } = useProfile();
  const [bookings, setBookings] = useState<BookingWithMeta[]>([]);
  const [loading, setLoading] = useState(true);

  function refresh() {
    if (!userId) return;
    setLoading(true);
    listMyBookings(userId).then((b) => {
      setBookings(b);
      setLoading(false);
    });
  }

  useEffect(() => {
    if (!profileLoading) refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, profileLoading]);

  if (profileLoading) return <p className="text-sm text-charcoal-500">Loading…</p>;
  if (!userId) {
    return (
      <Card>
        <p className="text-sm text-charcoal-700">
          Please <Link href="/auth" className="font-semibold underline">sign in</Link> to see your bookings.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <SectionTitle title="My Bookings" sub="Request → accept → pay in advance (simulated) → confirm → check in within 15 minutes → work → settlement." />
      {loading ? (
        <p className="text-sm text-charcoal-500">Loading…</p>
      ) : bookings.length === 0 ? (
        <EmptyState title="No bookings yet" sub="Find a barber on the home page and book your first slot." />
      ) : (
        bookings.map((b) => <BookingCard key={b.id} booking={b} onChange={refresh} />)
      )}
    </div>
  );
}
