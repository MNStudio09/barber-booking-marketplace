'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { CITY, DISTANCE_FILTERS_KM } from '@/lib/config';
import { listApprovedShops, sortNearestFirst } from '@/lib/data';
import { directionsUrl, estimatedTravelMinutes } from '@/lib/geo';
import type { ShopWithMeta } from '@/lib/types';
import { Badge, Button, Card, EmptyState, Input, SectionTitle, fmt } from '@/components/ui';

const MapView = dynamic(() => import('@/components/MapView'), {
  ssr: false,
  loading: () => <div className="flex h-[360px] items-center justify-center rounded-2xl bg-beige-100 text-sm text-charcoal-500">Loading map…</div>,
});

type Radius = 'all' | 1 | 3 | 5;

export default function HomePage() {
  const [shops, setShops] = useState<ShopWithMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [radius, setRadius] = useState<Radius>('all');
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationError, setLocationError] = useState('');

  useEffect(() => {
    listApprovedShops().then((s) => {
      setShops(s);
      setLoading(false);
    });
  }, []);

  function useMyLocation() {
    if (!navigator.geolocation) {
      setLocationError('Your browser does not support location.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setLocationError('Location permission denied — showing all shops instead.'),
    );
  }

  const visible = useMemo(() => {
    let list = shops;
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.area.toLowerCase().includes(q) ||
          s.services.some((x) => x.name.toLowerCase().includes(q)),
      );
    }
    if (location) {
      list = sortNearestFirst(list, location.lat, location.lng);
      if (radius !== 'all') {
        list = list.filter((s) => s.distance_km != null && s.distance_km <= radius);
      }
    }
    return list;
  }, [shops, query, radius, location]);

  const center = useMemo(() => {
    if (location) return location;
    const withCoords = shops.find((s) => s.lat != null && s.lng != null);
    return withCoords ? { lat: withCoords.lat as number, lng: withCoords.lng as number } : null;
  }, [location, shops]);

  return (
    <div className="space-y-6">
      {/* Hero */}
      <section className="rounded-3xl bg-charcoal-900 px-6 py-10 text-white sm:px-10">
        <p className="text-sm font-semibold uppercase tracking-widest text-beige-300">{CITY}</p>
        <h1 className="mt-2 max-w-xl text-3xl font-bold leading-tight sm:text-4xl">
          Book a barber. Arrive on time. No waiting in line.
        </h1>
        <p className="mt-3 max-w-xl text-beige-200">
          Find nearby barber shops, see services and prices, book your time slot online —
          and walk in at your booked time.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Button variant="outline" className="border-white text-white hover:bg-charcoal-800" onClick={useMyLocation}>
            📍 Use my location
          </Button>
          <Link href="/barber">
            <Button className="bg-beige-200 text-charcoal-900 hover:bg-beige-300">
              Barber? Register your shop — it&apos;s free
            </Button>
          </Link>
        </div>
        {locationError ? <p className="mt-3 text-sm text-beige-300">{locationError}</p> : null}
      </section>

      {/* Search + filters */}
      <section className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex-1">
          <Input
            placeholder="Search shops, areas or services — e.g. haircut, beard trim…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-charcoal-500">Distance:</span>
          {(['all', ...DISTANCE_FILTERS_KM] as Radius[]).map((r) => (
            <button
              key={String(r)}
              onClick={() => setRadius(r)}
              disabled={r !== 'all' && !location}
              className={
                radius === r
                  ? 'rounded-full bg-charcoal-900 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-40'
                  : 'rounded-full border border-beige-300 bg-white px-3 py-1.5 text-sm font-medium text-charcoal-700 hover:bg-beige-100 disabled:opacity-40'
              }
            >
              {r === 'all' ? 'All' : `${r} km`}
            </button>
          ))}
          {!location ? (
            <span className="text-xs text-charcoal-500">(enable location for distance filters)</span>
          ) : null}
        </div>
      </section>

      {/* Map */}
      {center ? (
        <MapView shops={visible} center={center} userLocation={location} />
      ) : (
        <Card>
          <p className="text-sm text-charcoal-600">
            The map appears once a shop with a location is available, or after you enable your location.
          </p>
        </Card>
      )}

      {/* Shop list */}
      <section>
        <SectionTitle
          title={location ? 'Nearest shops first' : 'Barber shops'}
          sub={loading ? 'Loading shops…' : `${visible.length} shop${visible.length === 1 ? '' : 's'} found`}
        />
        {loading ? (
          <p className="text-sm text-charcoal-500">Loading…</p>
        ) : visible.length === 0 ? (
          <EmptyState
            title="No shops here yet"
            sub="The live database starts empty — the first shop registers and is approved by an admin, then it appears here."
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {visible.map((s) => (
              <Card key={s.id}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-bold text-charcoal-900">{s.name}</h3>
                    <p className="text-sm text-charcoal-500">
                      {s.area} · {s.city}
                    </p>
                  </div>
                  {s.rating_avg != null ? (
                    <Badge tone="amber">
                      ★ {s.rating_avg.toFixed(1)} ({s.rating_count})
                    </Badge>
                  ) : (
                    <Badge>New</Badge>
                  )}
                </div>
                <p className="mt-2 text-sm text-charcoal-600">
                  {s.services.length > 0
                    ? s.services.slice(0, 3).map((x) => `${x.name} ${fmt(x.price)}`).join(' · ')
                    : 'Services coming soon'}
                </p>
                <p className="mt-1 text-sm text-charcoal-500">
                  {s.distance_km != null
                    ? `${s.distance_km.toFixed(1)} km away · ~${estimatedTravelMinutes(s.distance_km)} min`
                    : `Open ${s.opening_time} – ${s.closing_time}`}
                </p>
                <div className="mt-4 flex gap-2">
                  <Link href={`/shop/${s.id}`} className="flex-1">
                    <Button className="w-full">View &amp; book</Button>
                  </Link>
                  {s.lat != null && s.lng != null ? (
                    <a href={directionsUrl(s.lat, s.lng)} target="_blank" rel="noreferrer">
                      <Button variant="outline">Directions</Button>
                    </a>
                  ) : null}
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
