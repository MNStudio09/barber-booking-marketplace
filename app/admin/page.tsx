'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { deleteShop, getDatabaseSnapshot, resolveDispute, setShopStatus, type DatabaseSnapshot } from '@/lib/actions-finance';
import { listAllBookings, listAllShops, listLedger, listProfiles } from '@/lib/data';
import { getBrowserSupabase } from '@/lib/supabase';
import { useProfile } from '@/lib/use-profile';
import type { BookingWithMeta, Dispute, Profile, Shop } from '@/lib/types';
import { Badge, Button, Card, EmptyState, Input, SectionTitle, StatusBadge, fmt } from '@/components/ui';

type Tab = 'shops' | 'users' | 'bookings' | 'disputes' | 'reports' | 'database';

export default function AdminPage() {
  const { profile, loading: profileLoading } = useProfile();
  const [tab, setTab] = useState<Tab>('shops');
  const [shops, setShops] = useState<Shop[]>([]);
  const [users, setUsers] = useState<Profile[]>([]);
  const [bookings, setBookings] = useState<BookingWithMeta[]>([]);
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [ledger, setLedger] = useState<{ type: string; amount: number }[]>([]);
  const [snapshot, setSnapshot] = useState<DatabaseSnapshot | null>(null);
  const [dbTable, setDbTable] = useState<string>('shops');
  const [dbQuery, setDbQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [resolveNote, setResolveNote] = useState('');

  function refresh() {
    setLoading(true);
    Promise.all([
      listAllShops(),
      listProfiles(),
      listAllBookings(),
      listLedger(),
      getBrowserSupabase().from('disputes').select('*').order('created_at', { ascending: false }),
    ]).then(([s, u, b, l, d]) => {
      setShops(s);
      setUsers(u);
      setBookings(b);
      setLedger(l.map((e) => ({ type: e.type, amount: e.amount })));
      setDisputes(((d.data ?? []) as Dispute[]));
      setLoading(false);
    });
  }

  useEffect(() => {
    if (!profileLoading) refresh();
  }, [profileLoading]);

  async function loadDatabase() {
    setLoading(true);
    const snap = await getDatabaseSnapshot();
    setSnapshot(snap);
    setLoading(false);
  }

  async function run(fn: () => Promise<{ ok: boolean; error?: string }>, success: string) {
    setBusy(true);
    setMessage('');
    const res = await fn();
    setBusy(false);
    setMessage(res.ok ? success : res.error ?? 'Something went wrong.');
    if (res.ok) refresh();
  }

  const reports = useMemo(() => {
    const sum = (type: string) => ledger.filter((e) => e.type === type).reduce((a, e) => a + e.amount, 0);
    return {
      shops: shops.length,
      approvedShops: shops.filter((s) => s.status === 'approved').length,
      pendingShops: shops.filter((s) => s.status === 'pending').length,
      users: users.length,
      bookings: bookings.length,
      settled: bookings.filter((b) => b.status === 'settled').length,
      openDisputes: disputes.filter((d) => d.status === 'open').length,
      collected: sum('payment_received'),
      commission: sum('commission'),
    };
  }, [shops, users, bookings, disputes, ledger]);

  const dbRows = useMemo(() => {
    if (!snapshot) return [];
    const rows = snapshot[dbTable] ?? [];
    const q = dbQuery.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => JSON.stringify(r).toLowerCase().includes(q));
  }, [snapshot, dbTable, dbQuery]);

  if (profileLoading) return <p className="text-sm text-charcoal-500">Loading…</p>;
  if (!profile || profile.role !== 'admin') {
    return (
      <Card>
        <p className="text-sm text-charcoal-700">
          The Admin Panel is for admins only. Please{' '}
          <Link href="/auth" className="font-semibold underline">sign in</Link> with an admin account.
          (First admin: run <code>update public.profiles set role = &apos;admin&apos; where email = &apos;you@example.com&apos;</code> in the Supabase SQL editor.)
        </p>
      </Card>
    );
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'shops', label: 'Shops' },
    { id: 'users', label: 'Users' },
    { id: 'bookings', label: 'Bookings' },
    { id: 'disputes', label: 'Disputes' },
    { id: 'reports', label: 'Reports' },
    { id: 'database', label: 'Database' },
  ];

  return (
    <div className="space-y-6">
      <SectionTitle title="Admin Panel" sub="Users, shops, bookings, disputes, reports — and the full database." />
      {message ? <p className="text-sm text-charcoal-700">{message}</p> : null}

      <div className="flex flex-wrap gap-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => {
              setTab(t.id);
              if (t.id === 'database' && !snapshot) loadDatabase();
            }}
            className={
              tab === t.id
                ? 'rounded-full bg-charcoal-900 px-3 py-1.5 text-sm font-semibold text-white'
                : 'rounded-full border border-beige-300 bg-white px-3 py-1.5 text-sm font-medium text-charcoal-700 hover:bg-beige-100'
            }
          >
            {t.label}
            {t.id === 'disputes' && reports.openDisputes > 0 ? ` (${reports.openDisputes})` : ''}
          </button>
        ))}
      </div>

      {loading && tab !== 'database' ? <p className="text-sm text-charcoal-500">Loading…</p> : null}

      {tab === 'shops' && (
        <div className="space-y-3">
          {shops.length === 0 ? (
            <EmptyState title="No shops yet" sub="Shops register from the Barber Panel. New shops stay pending until you approve them." />
          ) : (
            shops.map((s) => (
              <Card key={s.id} className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-semibold">{s.name}</p>
                  <p className="text-sm text-charcoal-500">{s.area}, {s.city} · {s.opening_time}–{s.closing_time}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={s.status === 'approved' ? 'green' : s.status === 'pending' ? 'amber' : 'red'}>{s.status}</Badge>
                  {s.status !== 'approved' ? (
                    <Button disabled={busy} onClick={() => run(() => setShopStatus(s.id, 'approved'), 'Shop approved — now visible to customers.')}>Approve</Button>
                  ) : null}
                  {s.status === 'approved' ? (
                    <Button variant="outline" disabled={busy} onClick={() => run(() => setShopStatus(s.id, 'suspended'), 'Shop suspended.')}>Suspend</Button>
                  ) : null}
                  {s.status !== 'rejected' ? (
                    <Button variant="ghost" disabled={busy} onClick={() => run(() => setShopStatus(s.id, 'rejected'), 'Shop rejected.')}>Reject</Button>
                  ) : null}
                  <Button variant="danger" disabled={busy} onClick={() => run(() => deleteShop(s.id), 'Shop deleted.')}>Delete</Button>
                </div>
              </Card>
            ))
          )}
        </div>
      )}

      {tab === 'users' && (
        <div className="space-y-2">
          {users.map((u) => (
            <Card key={u.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
              <div>
                <p className="font-semibold">{u.full_name ?? u.email}</p>
                <p className="text-sm text-charcoal-500">{u.email}{u.phone ? ` · ${u.phone}` : ''}</p>
              </div>
              <Badge>{u.role}</Badge>
            </Card>
          ))}
          {users.length === 0 ? <EmptyState title="No users yet" /> : null}
        </div>
      )}

      {tab === 'bookings' && (
        <div className="space-y-2">
          {bookings.map((b) => (
            <Card key={b.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
              <div>
                <p className="font-semibold">{b.shop_name} — {b.service_name}</p>
                <p className="text-sm text-charcoal-500">{b.customer_name ?? 'Customer'} · {b.date} at {b.time_slot} · {fmt(b.amount)}</p>
              </div>
              <StatusBadge status={b.status} />
            </Card>
          ))}
          {bookings.length === 0 ? <EmptyState title="No bookings yet" /> : null}
        </div>
      )}

      {tab === 'disputes' && (
        <div className="space-y-3">
          {disputes.length === 0 ? (
            <EmptyState title="No disputes" sub="Customer disputes on no-show bookings appear here. Settlement stays held until resolved." />
          ) : (
            disputes.map((d) => (
              <Card key={d.id}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold">Dispute on booking {d.booking_id.slice(0, 8)}…</p>
                  <Badge tone={d.status === 'open' ? 'amber' : 'green'}>{d.status.replace('_', ' ')}</Badge>
                </div>
                <p className="mt-1 text-sm text-charcoal-700">{d.reason}</p>
                {d.status === 'open' ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <input
                      className="w-full rounded-xl border border-beige-300 bg-white px-3 py-2 text-sm outline-none"
                      placeholder="Resolution note (optional)"
                      value={resolveNote}
                      onChange={(e) => setResolveNote(e.target.value)}
                    />
                    <Button disabled={busy} onClick={() => run(() => resolveDispute(d.id, 'customer', resolveNote), 'Resolved for the customer — full refund requested.')}>
                      Resolve for customer (full refund)
                    </Button>
                    <Button variant="outline" disabled={busy} onClick={() => run(() => resolveDispute(d.id, 'barber', resolveNote), 'Resolved for the barber — the 10/10/80 split stands.')}>
                      Resolve for barber (keep 10/10/80)
                    </Button>
                  </div>
                ) : d.resolution_note ? (
                  <p className="mt-2 text-sm text-charcoal-500">Note: {d.resolution_note}</p>
                ) : null}
              </Card>
            ))
          )}
        </div>
      )}

      {tab === 'reports' && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { label: 'Shops', value: `${reports.approvedShops} approved / ${reports.pendingShops} pending / ${reports.shops} total` },
            { label: 'Users', value: String(reports.users) },
            { label: 'Bookings', value: `${reports.bookings} total · ${reports.settled} settled` },
            { label: 'Open disputes', value: String(reports.openDisputes) },
            { label: 'Collected (pay in)', value: fmt(reports.collected) },
            { label: 'Platform commission', value: fmt(reports.commission) },
          ].map((r) => (
            <Card key={r.label}>
              <p className="text-sm text-charcoal-500">{r.label}</p>
              <p className="text-lg font-bold text-charcoal-900">{r.value}</p>
            </Card>
          ))}
        </div>
      )}

      {tab === 'database' && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" disabled={busy} onClick={loadDatabase}>Reload database</Button>
            <Input placeholder="Search records…" value={dbQuery} onChange={(e) => setDbQuery(e.target.value)} className="max-w-xs" />
          </div>
          <div className="flex flex-wrap gap-1">
            {snapshot ? Object.keys(snapshot).map((t) => (
              <button
                key={t}
                onClick={() => setDbTable(t)}
                className={
                  dbTable === t
                    ? 'rounded-full bg-charcoal-900 px-3 py-1.5 text-sm font-semibold text-white'
                    : 'rounded-full border border-beige-300 bg-white px-3 py-1.5 text-sm font-medium text-charcoal-700 hover:bg-beige-100'
                }
              >
                {t} ({snapshot[t].length})
              </button>
            )) : <p className="text-sm text-charcoal-500">Loading database…</p>}
          </div>
          {snapshot && dbRows.length === 0 ? (
            <EmptyState title="No records in this table" sub="The live database starts empty — records appear as shops register and bookings are made." />
          ) : (
            <div className="space-y-2">
              {dbRows.slice(0, 100).map((row, i) => (
                <details key={i} className="rounded-2xl border border-beige-200 bg-white p-3">
                  <summary className="cursor-pointer text-sm font-medium text-charcoal-800">
                    {(row as Record<string, unknown>).id as string ?? `record ${i + 1}`}
                    {' — '}
                    <span className="text-charcoal-500">{(row as Record<string, unknown>).created_at as string ?? ''}</span>
                  </summary>
                  <pre className="mt-2 overflow-x-auto rounded-xl bg-beige-50 p-3 text-xs text-charcoal-800">
                    {JSON.stringify(row, null, 2)}
                  </pre>
                </details>
              ))}
              {dbRows.length > 100 ? <p className="text-sm text-charcoal-500">Showing first 100 of {dbRows.length} matching records.</p> : null}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
