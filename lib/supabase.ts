// Supabase clients.
// Clients are created LAZILY (inside functions, never at module scope) so
// `next build` succeeds even before env vars are configured. At runtime the
// real env vars are required — see README.md and .env.example.
//
// - Browser client: used by client components, honours Row Level Security.
// - Server client: used by server actions / route handlers, uses the
//   service-role key and bypasses RLS. Server-only — never import it into
//   a client component.

import { createBrowserClient } from '@supabase/ssr';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const PLACEHOLDER_URL = 'https://placeholder.supabase.co';
const PLACEHOLDER_KEY = 'placeholder-anon-key';

function publicUrl(): string {
  return process.env.NEXT_PUBLIC_SUPABASE_URL || PLACEHOLDER_URL;
}

function anonKey(): string {
  return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || PLACEHOLDER_KEY;
}

export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

let browserClient: SupabaseClient | null = null;

export function getBrowserSupabase(): SupabaseClient {
  if (!browserClient) {
    browserClient = createBrowserClient(publicUrl(), anonKey());
  }
  return browserClient;
}

let serverClient: SupabaseClient | null = null;

/** Service-role client for server-side writes (settlement, admin). */
export function getServiceSupabase(): SupabaseClient {
  if (!serverClient) {
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || PLACEHOLDER_KEY;
    serverClient = createClient(publicUrl(), serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return serverClient;
}
