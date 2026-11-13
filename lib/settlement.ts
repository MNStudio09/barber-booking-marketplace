// Settlement maths — the money rules of the marketplace.
// These are pure functions (no DB, no I/O) so they can be unit-tested.
// All amounts are integer PKR.
//
// AGREED RULES (do not change):
//   Completed booking: barber 90% / platform 10% commission.
//   No-show: barber waiting compensation 10% / platform commission 10% /
//   customer refund 80%, after a dispute period. Settlement is held while
//   a dispute is unresolved. A barber must NOT be able to no-show a
//   checked-in customer.

import { COMMISSION_RATE } from './config';

export interface CompletedSettlement {
  /** Amount the barber earns for a completed booking. */
  barber: number;
  /** Amount the platform keeps as commission. */
  platform: number;
}

export interface NoShowSettlement {
  /** Waiting compensation paid to the barber. */
  barberWaiting: number;
  /** Commission kept by the platform. */
  platform: number;
  /** Amount refunded to the customer. */
  customerRefund: number;
}

/** Completed booking: 90% barber, 10% platform. */
export function settleCompleted(amount: number): CompletedSettlement {
  const platform = Math.round(amount * COMMISSION_RATE);
  return { barber: amount - platform, platform };
}

/** No-show: 10% barber waiting, 10% platform, 80% customer refund. */
export function settleNoShow(amount: number): NoShowSettlement {
  const barberWaiting = Math.round(amount * COMMISSION_RATE);
  const platform = Math.round(amount * COMMISSION_RATE);
  return { barberWaiting, platform, customerRefund: amount - barberWaiting - platform };
}

/** A disputed no-show resolved FOR the customer: full refund. */
export function settleDisputedNoShowForCustomer(amount: number): { customerRefund: number; barberWaiting: number; platform: number } {
  return { customerRefund: amount, barberWaiting: 0, platform: 0 };
}

/** True when the three parts of a split add back up to the original amount. */
export function splitAddsUp(parts: number[], amount: number): boolean {
  return parts.reduce((a, b) => a + b, 0) === amount;
}

/** Generate a 4-digit OTP for booking check-in. */
export function generateOtp(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

/** Human-readable booking status label. */
export const BOOKING_STATUS_LABELS: Record<string, string> = {
  requested: 'Requested',
  awaiting_payment: 'Awaiting Payment',
  paid: 'Paid',
  confirmed: 'Confirmed',
  in_progress: 'In Progress',
  completed: 'Completed',
  no_show: 'No Show',
  refund_pending: 'Refund Pending',
  settled: 'Settled',
  cancelled: 'Cancelled',
  rejected: 'Rejected',
};

export function bookingStatusLabel(status: string): string {
  return BOOKING_STATUS_LABELS[status] ?? status;
}
