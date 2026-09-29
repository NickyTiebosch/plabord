/**
 * Omgevingsvariabelen. Alleen uitlezen op het moment van gebruik, zodat de build ook
 * zonder sleutels slaagt. De secret key staat bewust niet hier maar in db/admin.ts.
 */

export class ConfigError extends Error {
  constructor(name: string) {
    super(`De omgevingsvariabele ${name} ontbreekt. Zie .env.example en de README.`);
    this.name = 'ConfigError';
  }
}

export function supabaseUrl(): string {
  const value = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!value) throw new ConfigError('NEXT_PUBLIC_SUPABASE_URL');
  return value;
}

export function supabasePublishableKey(): string {
  const value = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!value) throw new ConfigError('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY');
  return value;
}

export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  );
}

/** Vaste basis voor agendalinks, als die is ingesteld. */
export function configuredSiteUrl(): string | null {
  const value = process.env.SITE_URL?.trim();
  return value ? value.replace(/\/+$/, '') : null;
}

/**
 * Cookies voor de sessie: 400 dagen (het maximum van browsers), zodat je op je eigen telefoon
 * ingelogd blijft. httpOnly, want alleen de server leest de sessie.
 */
export function sessionCookieOptions() {
  return {
    path: '/',
    sameSite: 'lax' as const,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 400 * 24 * 60 * 60,
  };
}
