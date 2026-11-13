'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { getBrowserSupabase } from '@/lib/supabase';
import { Button, Card, Field, Input, SectionTitle } from '@/components/ui';

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<'customer' | 'barber'>('customer');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage('');
    const supabase = getBrowserSupabase();
    if (mode === 'signup') {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName, phone, role } },
      });
      setBusy(false);
      if (error) {
        setMessage(error.message);
        return;
      }
      setMessage('Account created! Check your email to confirm, then sign in. (Email confirmation can be disabled in Supabase Auth settings for testing.)');
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setBusy(false);
      if (error) {
        setMessage(error.message);
        return;
      }
      router.push('/');
      router.refresh();
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-4">
      <SectionTitle
        title={mode === 'signin' ? 'Sign in' : 'Create your account'}
        sub="Customers book appointments; barbers register and manage their shop."
      />
      <Card>
        <form onSubmit={submit} className="space-y-4">
          {mode === 'signup' ? (
            <>
              <Field label="Full name">
                <Input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
              </Field>
              <Field label="Phone">
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="03xx-xxxxxxx" />
              </Field>
              <Field label="I am a">
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as 'customer' | 'barber')}
                  className="w-full rounded-xl border border-beige-300 bg-white px-3 py-2 text-sm outline-none"
                >
                  <option value="customer">Customer — I want to book barbers</option>
                  <option value="barber">Barber — I want to register my shop</option>
                </select>
              </Field>
            </>
          ) : null}
          <Field label="Email">
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </Field>
          <Field label="Password">
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
          </Field>
          <Button type="submit" disabled={busy} className="w-full">
            {busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}
          </Button>
          {message ? <p className="text-sm text-charcoal-700">{message}</p> : null}
        </form>
        <button
          className="mt-4 w-full text-center text-sm font-medium text-charcoal-600 underline"
          onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
        >
          {mode === 'signin' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
        </button>
      </Card>
      <p className="text-xs text-charcoal-500">
        Admin and finance accounts are created by an existing admin (role is set in Supabase) — sign-up only ever creates customer or barber accounts.
      </p>
    </div>
  );
}
