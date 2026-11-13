// App-wide configuration.
// The launch city is TBD — it is a single configurable value, never
// hard-coded into pages. Set NEXT_PUBLIC_CITY when the city is chosen.

export const CITY: string = process.env.NEXT_PUBLIC_CITY || 'Your City';

export const COUNTRY = 'Pakistan';

export const CURRENCY = 'Rs';

export const COMMISSION_RATE = 0.1; // 10% platform commission

export const CHECK_IN_WINDOW_MINUTES = 15;

export const DISTANCE_FILTERS_KM = [1, 3, 5] as const;

export const APP_NAME = 'Barber Booking Marketplace';
