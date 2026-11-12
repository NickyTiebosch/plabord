import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { ConfigError, supabaseUrl } from '../env';
import type { Database } from './database.types';

/**
 * Supabase-client met de secret key: omzeilt RLS. Alleen op de server en alleen voor:
 * - accountbeheer (aanmaken, e-mailadres wijzigen, blokkeren bij inactief);
 * - agendafeeds serveren;
 * - (fase 3) een medewerker volledig verwijderen;
 * - (fase 3) de geplande taak voor mails en pushmeldingen;
 * - (fase 5) de mails en pushmeldingen na een actie van een teamleider (V43): die mag de werkmails
 *   en toestellen van collega's zelf niet lezen.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new ConfigError('SUPABASE_SECRET_KEY');
  return createClient<Database>(supabaseUrl(), key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

export type AdminClient = ReturnType<typeof createAdminClient>;
