// Server-side auth helpers for server actions.
// Uses @supabase/ssr with cookies so actions know the signed-in user.
// Never trust a user id passed from the client — always read it here.

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getServiceSupabase } from './supabase';
import type { Profile, Role } from './types';

const PLACEHOLDER_URL = 'https://placeholder.supabase.co';
const PLACEHOLDER_KEY = 'placeholder-anon-key';

function publicUrl(): string {
  return process.env.NEXT_PUBLIC_SUPABASE_URL || PLACEHOLDER_URL;
}

function anonKey(): string {
  return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || PLACEHOLDER_KEY;
}

export function getAuthSupabase() {
  const cookieStore = cookies();
  return createServerClient(publicUrl(), anonKey(), {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set(name: string, value: string, options: Record<string, unknown>) {
        try {
          cookieStore.set({ name, value, ...options });
        } catch {
          // Called from a Server Component — cookie write is a no-op there.
        }
      },
      remove(name: string, options: Record<string, unknown>) {
        try {
          cookieStore.set({ name, value: '', ...options });
        } catch {
          // No-op in Server Components.
        }
      },
    },
  });
}

export async function getCurrentUser() {
  const supabase = getAuthSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function getCurrentProfile(): Promise<Profile | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  const supabase = getServiceSupabase();
  const { data, error } = await supabase.from('profiles').select('*').eq('id', user.id).single();
  if (error || !data) return null;
  return data as Profile;
}

export async function requireRole(roles: Role[]): Promise<Profile> {
  const profile = await getCurrentProfile();
  if (!profile) throw new Error('Not signed in.');
  if (!roles.includes(profile.role)) {
    throw new Error(`This action needs one of these roles: ${roles.join(', ')}.`);
  }
  return profile;
}

/** Shop owner check: the profile owns the shop. */
export async function requireShopOwner(shopId: string): Promise<Profile> {
  const profile = await getCurrentProfile();
  if (!profile) throw new Error('Not signed in.');
  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from('shops')
    .select('owner_id')
    .eq('id', shopId)
    .single();
  if (error || !data) throw new Error('Shop not found.');
  if (data.owner_id !== profile.id && profile.role !== 'admin') {
    throw new Error('You do not own this shop.');
  }
  return profile;
}
