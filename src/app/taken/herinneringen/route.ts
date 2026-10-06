import { timingSafeEqual } from 'node:crypto';
import { createAdminClient } from '@/lib/db/admin';
import { runMailJob } from '@/lib/mail/dispatch';
import { siteBaseUrl } from '@/lib/site-url';

export const dynamic = 'force-dynamic';

const HEADERS = { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' };

/** Alleen met het geheim `CRON_SECRET` (minstens 32 tekens), in constante tijd vergeleken. */
function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret || secret.length < 32) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const given = Buffer.from(request.headers.get('authorization') ?? '');
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/**
 * De geplande taak voor mails (fase 3): mislukte mails opnieuw proberen, om 16:00 de herinneringen
 * voor morgen (V15), en de wachtrij opruimen. Geen sessie: daarom met de secret key (besluit V17).
 * Het antwoord bevat alleen aantallen.
 *
 * Vercel Cron roept dit elk uur aan (vercel.json, besluit V32): met GET, en met CRON_SECRET als
 * Bearer-token. Met de hand starten kan ook met POST.
 */
async function runJob(request: Request) {
  if (!authorized(request)) return new Response('Niet toegestaan', { status: 401, headers: HEADERS });
  try {
    const result = await runMailJob(createAdminClient(), { now: new Date(), appUrl: `${await siteBaseUrl()}/` });
    return Response.json(result, { headers: HEADERS });
  } catch (error) {
    console.error('Taak voor mails mislukt', error instanceof Error ? error.message : error);
    return new Response('Mislukt', { status: 500, headers: HEADERS });
  }
}

export const GET = runJob;
export const POST = runJob;
