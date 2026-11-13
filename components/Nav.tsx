'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { getBrowserSupabase } from '@/lib/supabase';
import { useProfile } from '@/lib/use-profile';
import { APP_NAME } from '@/lib/config';
import { Button } from './ui';

const LINKS = [
  { href: '/', label: 'Find a Barber' },
  { href: '/bookings', label: 'My Bookings' },
  { href: '/barber', label: 'Barber Panel' },
  { href: '/finance', label: 'Finance' },
  { href: '/admin', label: 'Admin' },
];

export default function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const { profile, loading } = useProfile();

  async function signOut() {
    await getBrowserSupabase().auth.signOut();
    router.push('/');
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-40 border-b border-beige-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-charcoal-900 text-lg text-white">✂️</span>
          <span className="font-bold text-charcoal-900">{APP_NAME}</span>
        </Link>

        {/* Wraps on phone width so every panel stays visible and tappable. */}
        <nav className="flex flex-wrap items-center gap-1">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={
                pathname === l.href
                  ? 'rounded-full bg-charcoal-900 px-3 py-1.5 text-sm font-semibold text-white'
                  : 'rounded-full px-3 py-1.5 text-sm font-medium text-charcoal-700 hover:bg-beige-100'
              }
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {loading ? (
            <span className="text-sm text-charcoal-500">…</span>
          ) : profile ? (
            <>
              <span className="hidden text-sm text-charcoal-600 sm:inline">
                {profile.full_name ?? profile.email} · {profile.role}
              </span>
              <Button variant="outline" onClick={signOut}>
                Sign out
              </Button>
            </>
          ) : (
            <Link href="/auth">
              <Button>Sign in</Button>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
