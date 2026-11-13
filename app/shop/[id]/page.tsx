'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { createBooking } from '@/lib/actions';
import { getShop, getShopReviews } from '@/lib/data';
import { slotsForHours, directionsUrl } from '@/lib/geo';
import { useProfile } from '@/lib/use-profile';
import type { Review, ShopWithMeta } from '@/lib/types';
import { Badge, Button, Card, EmptyState, Field, Input, SectionTitle, Select, Textarea, fmt } from '@/components/ui';

export default function ShopPage() {
  const params = useParams<{ id: string }>();
  const shopId = params.id;
  const { userId, profile, loading: profileLoading } = useProfile();
  const [shop, setShop] = useState<ShopWithMeta | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [serviceId, setServiceId] = useState('');
  const [barberId, setBarberId] = useState('');
  const [date, setDate] = useState('');
  const [slot, setSlot] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    Promise.all([getShop(shopId), getShopReviews(shopId)]).then(([s, r]) => {
      setShop(s);
      setReviews(r);
      setLoading(false);
      if (s && s.services.length > 0) setServiceId(s.services[0].id);
    });
  }, [shopId]);

  const service = useMemo(() => shop?.services.find((s) => s.id === serviceId), [shop, serviceId]);

  const slots = useMemo(() => {
    if (!shop || !service) return [];
    return slotsForHours(shop.opening_time, shop.closing_time, service.duration_minutes);
  }, [shop, service]);

  const today = new Date().toISOString().slice(0, 10);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!serviceId || !date || !slot) {
      setMessage('Please pick a service, date and time slot.');
      return;
    }
    setBusy(true);
    setMessage('');
    const res = await createBooking({
      shopId,
      serviceId,
      barberId: barberId || null,
      date,
      timeSlot: slot,
      notes,
    });
    setBusy(false);
    setMessage(res.ok ? 'Booking request sent! The barber will accept or reject it — check My Bookings.' : res.error ?? 'Something went wrong.');
  }

  if (loading) return <p className="text-sm text-charcoal-500">Loading shop…</p>;
  if (!shop) return <EmptyState title="Shop not found" sub="It may have been removed or not approved yet." />;

  return (
    <div className="space-y-6">
      <Link href="/" className="text-sm font-medium text-charcoal-600 hover:text-charcoal-900">
        ← Back to shops
      </Link>

      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-charcoal-900">{shop.name}</h1>
            <p className="text-sm text-charcoal-500">
              {shop.area} · {shop.city} · {shop.address}
            </p>
            <p className="mt-1 text-sm text-charcoal-600">
              Open {shop.opening_time} – {shop.closing_time}
              {shop.phone ? ` · ${shop.phone}` : ''}
            </p>
          </div>
          {shop.rating_avg != null ? (
            <Badge tone="amber">★ {shop.rating_avg.toFixed(1)} · {shop.rating_count} reviews</Badge>
          ) : (
            <Badge>New shop</Badge>
          )}
        </div>
        {shop.description ? <p className="mt-3 text-sm text-charcoal-600">{shop.description}</p> : null}
        {shop.lat != null && shop.lng != null ? (
          <a href={directionsUrl(shop.lat, shop.lng)} target="_blank" rel="noreferrer" className="mt-3 inline-block">
            <Button variant="outline">Get directions</Button>
          </a>
        ) : null}
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Services */}
        <section>
          <SectionTitle title="Services & prices" />
          {shop.services.length === 0 ? (
            <EmptyState title="No services listed yet" />
          ) : (
            <div className="space-y-3">
              {shop.services.map((s) => (
                <Card key={s.id} className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-charcoal-900">{s.name}</p>
                    <p className="text-sm text-charcoal-500">
                      {s.duration_minutes} min{s.description ? ` · ${s.description}` : ''}
                    </p>
                  </div>
                  <span className="font-bold text-charcoal-900">{fmt(s.price)}</span>
                </Card>
              ))}
            </div>
          )}
          {shop.barbers.length > 0 ? (
            <div className="mt-6">
              <SectionTitle title="Barbers" />
              <div className="space-y-2">
                {shop.barbers.map((b) => (
                  <Card key={b.id} className="flex justify-between py-3">
                    <span className="font-medium">{b.name}</span>
                    <span className="text-sm text-charcoal-500">{b.specialty ?? 'Barber'}</span>
                  </Card>
                ))}
              </div>
            </div>
          ) : null}
        </section>

        {/* Booking form */}
        <section>
          <SectionTitle title="Book an appointment" sub="Request first — the barber accepts, then you pay in advance (simulated) to confirm." />
          {profileLoading ? (
            <p className="text-sm text-charcoal-500">Loading…</p>
          ) : !userId ? (
            <Card>
              <p className="text-sm text-charcoal-700">
                Please <Link href="/auth" className="font-semibold underline">sign in</Link> to book an appointment.
              </p>
            </Card>
          ) : (
            <Card>
              <form onSubmit={submit} className="space-y-4">
                <Field label="Service">
                  <Select value={serviceId} onChange={(e) => { setServiceId(e.target.value); setSlot(''); }}>
                    {shop.services.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} — {fmt(s.price)} · {s.duration_minutes} min
                      </option>
                    ))}
                  </Select>
                </Field>
                {shop.barbers.length > 0 ? (
                  <Field label="Barber (optional)">
                    <Select value={barberId} onChange={(e) => setBarberId(e.target.value)}>
                      <option value="">Any barber</option>
                      {shop.barbers.map((b) => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </Select>
                  </Field>
                ) : null}
                <Field label="Date">
                  <Input type="date" min={today} value={date} onChange={(e) => { setDate(e.target.value); setSlot(''); }} required />
                </Field>
                <Field label="Time slot (shop hours only)">
                  <Select value={slot} onChange={(e) => setSlot(e.target.value)} required>
                    <option value="">Pick a time…</option>
                    {slots.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </Select>
                  {slots.length === 0 && service ? (
                    <p className="mt-1 text-xs text-charcoal-500">No slots fit this service inside opening hours.</p>
                  ) : null}
                </Field>
                <Field label="Notes (optional)">
                  <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything the barber should know?" />
                </Field>
                <Button type="submit" disabled={busy} className="w-full">
                  {busy ? 'Sending…' : service ? `Request booking — ${fmt(service.price)}` : 'Request booking'}
                </Button>
                {message ? <p className="text-sm text-charcoal-700">{message}</p> : null}
              </form>
            </Card>
          )}
        </section>
      </div>

      {/* Reviews */}
      <section>
        <SectionTitle title={`Reviews (${reviews.length})`} />
        {reviews.length === 0 ? (
          <EmptyState title="No reviews yet" sub="Customers can leave one review per completed booking." />
        ) : (
          <div className="space-y-3">
            {reviews.map((r) => (
              <Card key={r.id}>
                <p className="font-semibold">{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</p>
                {r.comment ? <p className="mt-1 text-sm text-charcoal-700">{r.comment}</p> : null}
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
