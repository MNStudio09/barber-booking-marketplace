'use client';

// OpenStreetMap + Leaflet map (free, no API key). Loaded with ssr:false from
// the home page so Leaflet only ever runs in the browser.

import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet';
import L from 'leaflet';
import Link from 'next/link';
import 'leaflet/dist/leaflet.css';
import type { ShopWithMeta } from '@/lib/types';
import { fmt } from './ui';

const pinIcon = L.divIcon({
  className: '',
  html: '<div style="background:#211d1a;color:#fff;border:2px solid #f3ede1;border-radius:9999px;width:28px;height:28px;display:flex;align-items:center;justify-content:center;font-size:14px;box-shadow:0 2px 6px rgba(0,0,0,.35)">✂</div>',
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

const userIcon = L.divIcon({
  className: '',
  html: '<div style="background:#2563eb;border:2px solid #fff;border-radius:9999px;width:16px;height:16px;box-shadow:0 2px 6px rgba(0,0,0,.35)"></div>',
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

export default function MapView({
  shops,
  center,
  userLocation,
}: {
  shops: ShopWithMeta[];
  center: { lat: number; lng: number };
  userLocation: { lat: number; lng: number } | null;
}) {
  const plotted = shops.filter((s) => s.lat != null && s.lng != null);
  return (
    <MapContainer
      center={[center.lat, center.lng]}
      zoom={13}
      scrollWheelZoom={false}
      style={{ height: 360, width: '100%' }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {userLocation ? <Marker position={[userLocation.lat, userLocation.lng]} icon={userIcon}>
        <Popup>You are here</Popup>
      </Marker> : null}
      {plotted.map((s) => (
        <Marker key={s.id} position={[s.lat as number, s.lng as number]} icon={pinIcon}>
          <Popup>
            <div className="text-sm">
              <strong>{s.name}</strong>
              <br />
              {s.area} ·{' '}
              {s.services.length > 0 ? `from ${fmt(Math.min(...s.services.map((x) => x.price)))}` : 'services coming soon'}
              <br />
              <Link href={`/shop/${s.id}`}>View &amp; book →</Link>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
