// Shared types for the Barber Booking Marketplace.
// Money is stored as integer PKR (rupees) everywhere — never floats.

export type Role = 'customer' | 'barber' | 'admin' | 'finance';

export type ShopStatus = 'pending' | 'approved' | 'suspended' | 'rejected';

export type BookingStatus =
  | 'requested'
  | 'awaiting_payment'
  | 'paid'
  | 'confirmed'
  | 'in_progress'
  | 'completed'
  | 'no_show'
  | 'refund_pending'
  | 'settled'
  | 'cancelled'
  | 'rejected';

export type PaymentMethod = 'jazzcash' | 'easypaisa' | 'bank' | 'card';

export type PayoutType = 'barber_payout' | 'refund';

export type PayoutStatus = 'requested' | 'approved' | 'paid';

export type DisputeStatus = 'open' | 'resolved_customer' | 'resolved_barber';

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  role: Role;
  created_at: string;
}

export interface Shop {
  id: string;
  owner_id: string;
  name: string;
  area: string;
  city: string;
  address: string;
  lat: number | null;
  lng: number | null;
  phone: string | null;
  description: string | null;
  status: ShopStatus;
  opening_time: string; // 'HH:MM'
  closing_time: string; // 'HH:MM'
  created_at: string;
}

export interface Service {
  id: string;
  shop_id: string;
  name: string;
  price: number; // PKR, integer
  duration_minutes: number;
  description: string | null;
  created_at: string;
}

export interface Barber {
  id: string;
  shop_id: string;
  name: string;
  phone: string | null;
  specialty: string | null;
  active: boolean;
  created_at: string;
}

export interface Booking {
  id: string;
  shop_id: string;
  service_id: string;
  barber_id: string | null;
  customer_id: string;
  date: string; // YYYY-MM-DD
  time_slot: string; // 'HH:MM'
  notes: string | null;
  status: BookingStatus;
  amount: number; // PKR, integer — full service price, paid in advance
  otp_code: string | null; // 4-digit check-in code, set on confirmation
  checked_in_at: string | null;
  dispute_id: string | null;
  created_at: string;
}

export interface Payment {
  id: string;
  booking_id: string;
  amount: number;
  method: PaymentMethod;
  status: 'simulated' | 'verified' | 'failed';
  simulated: boolean; // always true in this build — see lib/payments.ts
  reference: string | null;
  created_at: string;
}

export interface Payout {
  id: string;
  shop_id: string | null;
  booking_id: string | null;
  type: PayoutType;
  amount: number;
  status: PayoutStatus;
  requested_by: string | null;
  created_at: string;
}

export interface LedgerEntry {
  id: string;
  booking_id: string | null;
  type:
    | 'payment_received'
    | 'commission'
    | 'barber_payable'
    | 'waiting_compensation'
    | 'refund'
    | 'payout';
  amount: number; // signed PKR: + money in, − money out
  description: string;
  created_at: string;
}

export interface Dispute {
  id: string;
  booking_id: string;
  raised_by: string;
  reason: string;
  status: DisputeStatus;
  resolution_note: string | null;
  created_at: string;
}

export interface Review {
  id: string;
  booking_id: string;
  shop_id: string;
  customer_id: string;
  rating: number; // 1–5
  comment: string | null;
  created_at: string;
}

// Joined views used by the UI.
export interface ShopWithMeta extends Shop {
  services: Service[];
  barbers: Barber[];
  rating_avg: number | null;
  rating_count: number;
  distance_km: number | null;
}

export interface BookingWithMeta extends Booking {
  shop_name: string;
  service_name: string;
  customer_name: string | null;
}
