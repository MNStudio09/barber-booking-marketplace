'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { approvePayout, markPayoutPaid } from '@/lib/actions-finance';
import { listLedger, listPayments, listPayouts } from '@/lib/data';
import { paymentBadge } from '@/lib/payments';
import { useProfile } from '@/lib/use-profile';
import type { LedgerEntry, Payment, Payout } from '@/lib/types';
import { Badge, Button, Card, EmptyState, SectionTitle, SimulatedTag, fmt } from '@/components/ui';

export default function FinancePage() {
  const { profile, loading: profileLoading } = useProfile();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  function refresh() {
    Promise.all([listPayments(), listPayouts(), listLedger()]).then(([p, o, l]) => {
      setPayments(p);
      setPayouts(o);
      setLedger(l);
      setLoading(false);
    });
  }

  useEffect(() => {
    if (!profileLoading) refresh();
  }, [profileLoading]);

  const balances = useMemo(() => {
    const sum = (type: string) => ledger.filter((e) => e.type === type).reduce((a, e) => a + e.amount, 0);
    const collected = sum('payment_received');
    const commission = sum('commission');
    const refundsPaid = Math.abs(ledger.filter((e) => e.type === 'payout').reduce((a, e) => a + e.amount, 0));
    const payoutsRequested = payouts.filter((p) => p.status === 'requested').reduce((a, p) => a + p.amount, 0);
    const payoutsApproved = payouts.filter((p) => p.status === 'approved').reduce((a, p) => a + p.amount, 0);
    const payoutsPaid = payouts.filter((p) => p.status === 'paid').reduce((a, p) => a + p.amount, 0);
    const refundsRequested = payouts.filter((p) => p.type === 'refund' && p.status === 'requested').reduce((a, p) => a + p.amount, 0);
    const refundsPaidOut = payouts.filter((p) => p.type === 'refund' && p.status === 'paid').reduce((a, p) => a + p.amount, 0);
    return { collected, commission, refundsPaid, payoutsRequested, payoutsApproved, payoutsPaid, refundsRequested, refundsPaidOut };
  }, [ledger, payouts]);

  async function run(fn: () => Promise<{ ok: boolean; error?: string }>, success: string) {
    setBusy(true);
    setMessage('');
    const res = await fn();
    setBusy(false);
    setMessage(res.ok ? success : res.error ?? 'Something went wrong.');
    if (res.ok) refresh();
  }

  if (profileLoading) return <p className="text-sm text-charcoal-500">Loading…</p>;
  if (!profile || !['admin', 'finance'].includes(profile.role)) {
    return (
      <Card>
        <p className="text-sm text-charcoal-700">
          The Finance Panel is for admin and finance roles only. Please{' '}
          <Link href="/auth" className="font-semibold underline">sign in</Link> with the right account.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <SectionTitle
        title="Finance Panel"
        sub="Every rupee in and out. Pay-outs move Requested → Approved → Paid, and money is only booked in the ledger when it is actually paid."
      />
      <p><SimulatedTag /></p>

      {/* Balances */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Collected (pay in)', value: balances.collected },
          { label: 'Platform commission', value: balances.commission },
          { label: 'Payouts paid', value: balances.payoutsPaid },
          { label: 'Refunds paid', value: balances.refundsPaidOut },
        ].map((b) => (
          <Card key={b.label}>
            <p className="text-sm text-charcoal-500">{b.label}</p>
            <p className="text-2xl font-bold text-charcoal-900">{fmt(b.value)}</p>
          </Card>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Card>
          <p className="text-sm text-charcoal-500">Payouts waiting</p>
          <p className="text-lg font-bold">Requested {fmt(balances.payoutsRequested)} · Approved {fmt(balances.payoutsApproved)}</p>
        </Card>
        <Card>
          <p className="text-sm text-charcoal-500">Refunds waiting</p>
          <p className="text-lg font-bold">{fmt(balances.refundsRequested)}</p>
        </Card>
      </div>
      {message ? <p className="text-sm text-charcoal-700">{message}</p> : null}

      {/* Pay In */}
      <section>
        <SectionTitle title={`Pay In — customer advance payments (${payments.length})`} />
        {loading ? (
          <p className="text-sm text-charcoal-500">Loading…</p>
        ) : payments.length === 0 ? (
          <EmptyState title="No payments yet" sub="Payments appear here when a customer pays in advance for a booking." />
        ) : (
          <div className="space-y-2">
            {payments.map((p) => (
              <Card key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <div>
                  <p className="font-semibold">{fmt(p.amount)} · {p.method}</p>
                  <p className="text-xs text-charcoal-500">{p.reference} · {new Date(p.created_at).toLocaleString()}</p>
                </div>
                <Badge tone="amber">{paymentBadge(p.simulated)}</Badge>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Pay Out */}
      <section>
        <SectionTitle title={`Pay Out — barber payouts & customer refunds (${payouts.length})`} />
        {loading ? (
          <p className="text-sm text-charcoal-500">Loading…</p>
        ) : payouts.length === 0 ? (
          <EmptyState title="No pay-outs yet" sub="Barbers request payouts from the Barber Panel; refunds are requested automatically on a no-show." />
        ) : (
          <div className="space-y-2">
            {payouts.map((p) => (
              <Card key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <p className="font-semibold">
                    {p.type === 'refund' ? 'Refund to customer' : 'Payout to barber'} — {fmt(p.amount)}
                  </p>
                  <p className="text-xs text-charcoal-500">{new Date(p.created_at).toLocaleString()}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={p.status === 'paid' ? 'green' : p.status === 'approved' ? 'blue' : 'amber'}>{p.status}</Badge>
                  {p.status === 'requested' ? (
                    <Button disabled={busy} onClick={() => run(() => approvePayout(p.id), 'Payout approved.')}>Approve</Button>
                  ) : null}
                  {p.status === 'approved' ? (
                    <Button disabled={busy} onClick={() => run(() => markPayoutPaid(p.id), 'Marked paid — booked in the ledger.')}>Mark paid</Button>
                  ) : null}
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Ledger */}
      <section>
        <SectionTitle title={`Ledger — every rupee (${ledger.length})`} />
        {loading ? (
          <p className="text-sm text-charcoal-500">Loading…</p>
        ) : ledger.length === 0 ? (
          <EmptyState title="Ledger is empty" />
        ) : (
          <div className="space-y-2">
            {ledger.map((e) => (
              <Card key={e.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <div>
                  <p className="font-medium">{e.description}</p>
                  <p className="text-xs text-charcoal-500">{e.type} · {new Date(e.created_at).toLocaleString()}</p>
                </div>
                <span className={e.amount >= 0 ? 'font-bold text-green-700' : 'font-bold text-red-700'}>
                  {e.amount >= 0 ? '+' : '−'} {fmt(Math.abs(e.amount))}
                </span>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
