// Distance + opening-hours helpers (pure functions).

export interface LatLng {
  lat: number;
  lng: number;
}

const EARTH_RADIUS_KM = 6371;

/** Haversine distance between two points, in kilometres. */
export function distanceKm(a: LatLng, b: LatLng): number {
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

/** 'HH:MM' → minutes since midnight. */
export function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

/** 'HH:MM' from minutes since midnight. */
export function minutesToTime(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * 30-minute slots inside a shop's opening hours.
 * A slot is offered only if the service fits before closing time.
 */
export function slotsForHours(openingTime: string, closingTime: string, durationMinutes: number): string[] {
  const open = timeToMinutes(openingTime);
  const close = timeToMinutes(closingTime);
  const slots: string[] = [];
  for (let t = open; t + durationMinutes <= close; t += 30) {
    slots.push(minutesToTime(t));
  }
  return slots;
}

/** Estimated travel time at ~30 km/h city speed, in minutes. */
export function estimatedTravelMinutes(distanceKmValue: number): number {
  return Math.max(1, Math.round((distanceKmValue / 30) * 60));
}

/** Google Maps Directions URL for a shop location. */
export function directionsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}
