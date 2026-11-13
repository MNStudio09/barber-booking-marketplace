'use client';

import { useEffect, useState } from 'react';
import { getBrowserSupabase } from '@/lib/supabase';
import type { Profile } from '@/lib/types';

/** Current signed-in user + their profile row (role drives panel access). */
export function useProfile() {
  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = getBrowserSupabase();
    let cancelled = false;

    async function load(sessionUserId: string | null) {
      setUserId(sessionUserId);
      if (!sessionUserId) {
        if (!cancelled) {
          setProfile(null);
          setLoading(false);
        }
        return;
      }
      const { data } = await supabase.from('profiles').select('*').eq('id', sessionUserId).single();
      if (!cancelled) {
        setProfile((data as Profile | null) ?? null);
        setLoading(false);
      }
    }

    supabase.auth.getSession().then(({ data }) => load(data.session?.user.id ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      load(session?.user.id ?? null);
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { userId, profile, loading };
}
