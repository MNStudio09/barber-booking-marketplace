import type { ButtonHTMLAttributes, InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { bookingStatusLabel } from '@/lib/settlement';

export function fmt(n: number): string {
  return `Rs ${n.toLocaleString('en-PK')}`;
}

export function cn(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ');
}

export function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('rounded-2xl border border-beige-200 bg-white p-4 shadow-sm sm:p-5', className)}>
      {children}
    </div>
  );
}

export function SectionTitle({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-xl font-bold text-charcoal-900">{title}</h2>
      {sub ? <p className="mt-1 text-sm text-charcoal-500">{sub}</p> : null}
    </div>
  );
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'dark' | 'outline' | 'ghost' | 'danger';
};

export function Button({ variant = 'primary', className, ...props }: ButtonProps) {
  const styles = {
    primary: 'bg-charcoal-900 text-white hover:bg-charcoal-800',
    dark: 'bg-charcoal-800 text-white hover:bg-charcoal-700',
    outline: 'border border-charcoal-700 text-charcoal-800 hover:bg-beige-100',
    ghost: 'text-charcoal-700 hover:bg-beige-100',
    danger: 'bg-red-700 text-white hover:bg-red-800',
  } as const;
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50',
        styles[variant],
        className,
      )}
      {...props}
    />
  );
}

export function Badge({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: 'neutral' | 'green' | 'amber' | 'red' | 'blue' }) {
  const tones = {
    neutral: 'bg-beige-100 text-charcoal-700',
    green: 'bg-green-100 text-green-800',
    amber: 'bg-amber-100 text-amber-900',
    red: 'bg-red-100 text-red-800',
    blue: 'bg-blue-100 text-blue-800',
  } as const;
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold', tones[tone])}>
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const tone: Record<string, 'neutral' | 'green' | 'amber' | 'red' | 'blue'> = {
    requested: 'blue',
    awaiting_payment: 'amber',
    paid: 'blue',
    confirmed: 'green',
    in_progress: 'blue',
    completed: 'green',
    no_show: 'red',
    refund_pending: 'amber',
    settled: 'green',
    cancelled: 'neutral',
    rejected: 'red',
  };
  return <Badge tone={tone[status] ?? 'neutral'}>{bookingStatusLabel(status)}</Badge>;
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        'w-full rounded-xl border border-beige-300 bg-white px-3 py-2 text-sm text-charcoal-900 outline-none focus:border-charcoal-700 focus:ring-1 focus:ring-charcoal-700',
        props.className,
      )}
    />
  );
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={cn(
        'w-full rounded-xl border border-beige-300 bg-white px-3 py-2 text-sm text-charcoal-900 outline-none focus:border-charcoal-700 focus:ring-1 focus:ring-charcoal-700',
        props.className,
      )}
    />
  );
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={cn(
        'w-full rounded-xl border border-beige-300 bg-white px-3 py-2 text-sm text-charcoal-900 outline-none focus:border-charcoal-700 focus:ring-1 focus:ring-charcoal-700',
        props.className,
      )}
    />
  );
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-charcoal-500">{label}</span>
      {children}
    </label>
  );
}

export function EmptyState({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-beige-300 bg-beige-50 px-4 py-8 text-center">
      <p className="font-semibold text-charcoal-800">{title}</p>
      {sub ? <p className="mt-1 text-sm text-charcoal-500">{sub}</p> : null}
    </div>
  );
}

export function SimulatedTag() {
  return <Badge tone="amber">Simulated — no real money moved</Badge>;
}
