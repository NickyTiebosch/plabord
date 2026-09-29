import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { sessionCookieOptions, supabasePublishableKey, supabaseUrl } from '../env';
import type { Database } from './database.types';

/**
 * Supabase-client met de sessie van de ingelogde gebruiker: RLS geldt.
 * Maak per verzoek een nieuwe aan.
 */
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient<Database>(supabaseUrl(), supabasePublishableKey(), {
    cookieOptions: sessionCookieOptions(),
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) cookieStore.set(name, value, options);
        } catch {
          // In een Server Component kan dit niet. De proxy ververst de sessie bij elk verzoek.
        }
      },
    },
  });
}

export type ServerClient = Awaited<ReturnType<typeof createClient>>;
