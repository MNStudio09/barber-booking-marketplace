import type { Metadata } from 'next';
import Nav from '@/components/Nav';
import { APP_NAME, CITY, COUNTRY } from '@/lib/config';
import './globals.css';

export const metadata: Metadata = {
  title: `${APP_NAME} — ${CITY}, ${COUNTRY}`,
  description:
    'Book a barber online and arrive at your booked time — no waiting in line. Shops register, list services and prices, and manage bookings, payments and payouts in one place.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Nav />
        <main className="mx-auto w-full max-w-6xl px-4 pb-16 pt-6 sm:px-6">{children}</main>
        <footer className="border-t border-beige-200 bg-white">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-1 px-4 py-6 text-sm text-charcoal-500 sm:px-6">
            <p>
              {APP_NAME} — {CITY}, {COUNTRY}
            </p>
            <p>
              Payments in this build are <strong>simulated</strong> — no real money moves.
              Real JazzCash / Easypaisa / bank integration is a later phase.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
