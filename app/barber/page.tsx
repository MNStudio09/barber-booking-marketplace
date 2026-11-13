'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  addBarber,
  addService,
  deleteService,
  endWork,
  markNoShow,
  registerShop,
  respondBooking,
  setBarberActive,
  startWork,
  updateShopHours,
} from '@/lib/actions';
import { barberPayableBalance, requestPayout } from '@/lib/actions-finance';
import { listAllShops, listShopBookings } from '@/lib/data';
import { useProfile } from '@/lib/use-profile';
import { CITY } from '@/lib/config';
import type { BookingWithMeta, Shop } from '@/lib/types';
import { Badge, Button, Card, EmptyState, Field, Input, SectionTitle, StatusBadge, Textarea, fmt } from '@/components/ui';

export default function BarberPanelPage() {
  const { userId, profile, loading: profileLoading } = useProfile();
  const [shop, setShop] = useState<Shop | null>(null);
  const [bookings, setBookings] = useState<BookingWithMeta[]>([]);
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  // Registration form
  const [name, setName] = useState('');
  const [area, setArea] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [description, setDescription] = useState('');
  const [opening, setOpening] = useState('09:00');
  const [closing, setClosing] = useState('21:00');
  // Service form
  const [svcName, setSvcName] = useState('');
  const [svcPrice, setSvcPrice] = useState('');
  const [svcDuration, setSvcDuration] = useState('30');
  const [svcDesc, setSvcDesc] = useState('');
  // Barber form
  const [barberName, setBarberName] = useState('');
  const [barberPhone, setBarberPhone] = useState('');
  const [barberSpecialty, setBarberSpecialty] = useState('');
  const [busy, setBusy] = useState(false);

  async function refresh() {
    if (!userId) return;
    const shops = await listAllShops();
    const mine = shops.find((s) => s.owner_id === userId) ?? null;
    setShop(mine);
    if (mine) {
      const [b, bal] = await Promise.all([listShopBookings(mine.id), barberPayableBalance(mine.id)]);
      setBookings(b);
      setBalance(bal);
    }
    setLoading(false);
  }

  useEffect(() => {
    if (!profileLoading) refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, profileLoading]);

  async function run(fn: () => Promise<{ ok: boolean; error?: string }>, success: string) {
    setBusy(true);
    setMessage('');
    const res = await fn();
    setBusy(false);
    setMessage(res.ok ? success : res.error ?? 'Something went wrong.');
    if (res.ok) refresh();
  }

  if (profileLoading) return <p className="text-sm text-charcoal-500">Loading…</p>;
  if (!userId || !profile) {
    return (
      <Card>
        <p className="text-sm text-charcoal-700">
          Please <Link href="/auth" className="font-semibold underline">sign in</Link> to manage your shop.
        </p>
      </Card>
    );
  }

  if (loading) return <p className="text-sm text-charcoal-500">Loading…</p>;

  if (!shop) {
    return (
      <div className="space-y-4">
        <SectionTitle title="Barber Panel — register your shop" sub="Registration is free. An admin approves your shop, then customers can find and book it." />
        <Card>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              run(
                () => registerShop({ name, area, city: CITY, address, phone, description, openingTime: opening, closingTime: closing }),
                'Shop registered! It stays pending until an admin approves it.',
              );
            }}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Shop name"><Input value={name} onChange={(e) => setName(e.target.value)} required /></Field>
              <Field label="Area"><Input value={area} onChange={(e) => setArea(e.target.value)} required placeholder="e.g. Gulberg, Model Town" /></Field>
              <Field label="Address"><Input value={address} onChange={(e) => setAddress(e.target.value)} required /></Field>
              <Field label="Phone"><Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="03xx-xxxxxxx" /></Field>
              <Field label="Opening time"><Input type="time" value={opening} onChange={(e) => setOpening(e.target.value)} required /></Field>
              <Field label="Closing time"><Input type="time" value={closing} onChange={(e) => setClosing(e.target.value)} required /></Field>
            </div>
            <Field label="About your shop (optional)">
              <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
            </Field>
            <Button type="submit" disabled={busy}>Register shop — free</Button>
            {message ? <p className="text-sm text-charcoal-700">{message}</p> : null}
          </form>
        </Card>
      </div>
    );
  }

  const requests = bookings.filter((b) => b.status === 'requested');
  const active = bookings.filter((b) => ['confirmed', 'in_progress', 'awaiting_payment', 'paid'].includes(b.status));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SectionTitle title={`Barber Panel — ${shop.name}`} sub={`${shop.area}, ${shop.city} · ${shop.opening_time} – ${shop.closing_time}`} />
        <Badge tone={shop.status === 'approved' ? 'green' : shop.status === 'pending' ? 'amber' : 'red'}>
          {shop.status === 'approved' ? 'Approved — visible to customers' : `Shop status: ${shop.status}`}
        </Badge>
      </div>
      {shop.status !== 'approved' ? (
        <Card>
          <p className="text-sm text-charcoal-700">
            Your shop is <strong>{shop.status}</strong>. It will appear to customers once an admin approves it.
          </p>
        </Card>
      ) : null}

      {/* Earnings */}
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-charcoal-500">Payable balance (settled earnings not yet paid out)</p>
            <p className="text-2xl font-bold text-charcoal-900">{fmt(balance)}</p>
          </div>
          <Button
            variant="outline"
            disabled={busy || balance <= 0}
            onClick={() => run(() => requestPayout({ shopId: shop.id, type: 'barber_payout', amount: balance }), 'Payout requested — Finance will approve and pay it.')}
          >
            Request payout ({fmt(balance)})
          </Button>
        </div>
        {message ? <p className="mt-2 text-sm text-charcoal-700">{message}</p> : null}
      </Card>

      {/* Booking requests */}
      <section>
        <SectionTitle title={`Booking requests (${requests.length})`} sub="Accept to send the customer a payment link; reject to decline." />
        {requests.length === 0 ? (
          <EmptyState title="No new requests" />
        ) : (
          <div className="space-y-3">
            {requests.map((b) => (
              <Card key={b.id} className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-semibold">{b.service_name} — {b.customer_name ?? 'Customer'}</p>
                  <p className="text-sm text-charcoal-500">{b.date} at {b.time_slot} · {fmt(b.amount)}</p>
                  {b.notes ? <p className="text-sm text-charcoal-600">Notes: {b.notes}</p> : null}
                </div>
                <div className="flex gap-2">
                  <Button disabled={busy} onClick={() => run(() => respondBooking(b.id, true), 'Accepted — customer can now pay to confirm.')}>Accept</Button>
                  <Button variant="outline" disabled={busy} onClick={() => run(() => respondBooking(b.id, false), 'Request rejected.')}>Reject</Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Active bookings / work status */}
      <section>
        <SectionTitle title="Today's work" sub="Check-in must happen within 15 minutes of the slot. Start Work only after check-in. A checked-in customer can never be marked as a no-show." />
        {active.length === 0 ? (
          <EmptyState title="No active bookings" />
        ) : (
          <div className="space-y-3">
            {active.map((b) => (
              <Card key={b.id} className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-semibold">{b.service_name} — {b.customer_name ?? 'Customer'}</p>
                  <p className="text-sm text-charcoal-500">{b.date} at {b.time_slot} · {fmt(b.amount)}</p>
                  <p className="mt-1"><StatusBadge status={b.status} /> {b.checked_in_at ? <Badge tone="green">Checked in</Badge> : <Badge>Not checked in</Badge>}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {b.status === 'confirmed' && b.checked_in_at ? (
                    <Button disabled={busy} onClick={() => run(() => startWork(b.id), 'Work started.')}>Start Work</Button>
                  ) : null}
                  {b.status === 'in_progress' ? (
                    <Button disabled={busy} onClick={() => run(() => endWork(b.id), 'Work finished — settlement recorded (90% you / 10% platform).')}>End Work</Button>
                  ) : null}
                  {b.status === 'confirmed' && !b.checked_in_at ? (
                    <Button variant="danger" disabled={busy} onClick={() => run(() => markNoShow(b.id), 'Marked as no-show (only after the 15-minute window).')}>Mark Not Arrived</Button>
                  ) : null}
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Services */}
      <section>
        <SectionTitle title="Services" />
        <Card>
          <form
            className="grid gap-3 sm:grid-cols-4"
            onSubmit={(e) => {
              e.preventDefault();
              run(
                () => addService(shop.id, { name: svcName, price: Number(svcPrice), durationMinutes: Number(svcDuration), description: svcDesc }),
                'Service added.',
              );
              setSvcName(''); setSvcPrice(''); setSvcDesc('');
            }}
          >
            <Field label="Name"><Input value={svcName} onChange={(e) => setSvcName(e.target.value)} required placeholder="Haircut" /></Field>
            <Field label="Price (Rs)"><Input type="number" min={0} value={svcPrice} onChange={(e) => setSvcPrice(e.target.value)} required /></Field>
            <Field label="Duration (min)"><Input type="number" min={5} value={svcDuration} onChange={(e) => setSvcDuration(e.target.value)} required /></Field>
            <Field label="Description"><Input value={svcDesc} onChange={(e) => setSvcDesc(e.target.value)} /></Field>
            <Button type="submit" disabled={busy} className="sm:col-span-4">Add service</Button>
          </form>
        </Card>
      </section>

      {/* Hours */}
      <section>
        <SectionTitle title="Opening hours" />
        <Card>
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              run(() => updateShopHours(shop.id, opening, closing), 'Hours updated — booking slots follow the new hours.');
            }}
          >
            <Field label="Opening"><Input type="time" value={opening} onChange={(e) => setOpening(e.target.value)} /></Field>
            <Field label="Closing"><Input type="time" value={closing} onChange={(e) => setClosing(e.target.value)} /></Field>
            <Button type="submit" disabled={busy}>Save hours</Button>
          </form>
          <p className="mt-2 text-xs text-charcoal-500">Current hours: {shop.opening_time} – {shop.closing_time}. Booking slots are only offered inside these hours.</p>
        </Card>
      </section>

      {/* Barbers in the shop */}
      <section>
        <SectionTitle title="Barbers in your shop" />
        <Card>
          <form
            className="grid gap-3 sm:grid-cols-3"
            onSubmit={(e) => {
              e.preventDefault();
              run(() => addBarber(shop.id, { name: barberName, phone: barberPhone, specialty: barberSpecialty }), 'Barber added.');
              setBarberName(''); setBarberPhone(''); setBarberSpecialty('');
            }}
          >
            <Field label="Name"><Input value={barberName} onChange={(e) => setBarberName(e.target.value)} required /></Field>
            <Field label="Phone"><Input value={barberPhone} onChange={(e) => setBarberPhone(e.target.value)} /></Field>
            <Field label="Specialty"><Input value={barberSpecialty} onChange={(e) => setBarberSpecialty(e.target.value)} placeholder="Fade, beard…" /></Field>
            <Button type="submit" disabled={busy} className="sm:col-span-3">Add barber</Button>
          </form>
        </Card>
      </section>
    </div>
  );
}
