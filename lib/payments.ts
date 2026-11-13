// Payments — SIMULATED ONLY in this build.
//
// Every payment created here is a ledger simulation: it records that the
// customer "paid in advance" so the booking flow can be exercised end to
// end, and it is labelled "Simulated" everywhere in the UI. No real money
// moves, no gateway is called, and no merchant credentials exist in this
// codebase. Customer funds are never held in a personal account — the code
// treats funds as platform-ledger entries only.
//
// ── REAL INTEGRATION (LATER PHASE) ─────────────────────────────────────
// When an authorised payment-provider / bank marketplace arrangement
// exists (JazzCash, Easypaisa, bank), replace `simulatePayment` with a
// live provider call behind an env flag, e.g. PAYMENTS_PROVIDER=jazzcash.
// The integration points are marked below with INTEGRATION POINT.
// Until then, PAYMENTS_MODE stays 'simulated' and nothing real is charged.

import type { PaymentMethod } from './types';

export type PaymentsMode = 'simulated';

export const PAYMENTS_MODE: PaymentsMode = 'simulated';

export const PAYMENT_METHODS: { id: PaymentMethod; label: string }[] = [
  { id: 'jazzcash', label: 'JazzCash' },
  { id: 'easypaisa', label: 'Easypaisa' },
  { id: 'bank', label: 'Bank Transfer' },
  { id: 'card', label: 'Debit / Credit Card' },
];

export interface SimulatedPaymentResult {
  status: 'simulated';
  reference: string;
  method: PaymentMethod;
  amount: number;
  /** Shown in the UI next to every payment. */
  label: string;
}

/**
 * Simulate a customer advance payment.
 * Returns a fake reference — there is no gateway call here.
 *
 * INTEGRATION POINT (later phase): when a real provider is authorised,
 * call the provider's checkout API here, verify the callback/webhook,
 * and only then return { status: 'verified', ... }. The booking flow in
 * lib/actions.ts only confirms a booking after this function reports a
 * successful payment, so the flow itself does not change.
 */
export async function simulatePayment(
  amount: number,
  method: PaymentMethod,
): Promise<SimulatedPaymentResult> {
  const reference = `SIM-${Date.now().toString(36).toUpperCase()}-${Math.floor(
    1000 + Math.random() * 9000,
  )}`;
  return {
    status: 'simulated',
    reference,
    method,
    amount,
    label: 'Simulated payment — no real money moved',
  };
}

/** UI badge text for a payment row. */
export function paymentBadge(simulated: boolean): string {
  return simulated ? 'Simulated' : 'Verified';
}
