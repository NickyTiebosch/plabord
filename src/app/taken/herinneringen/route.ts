import { timingSafeEqual } from 'node:crypto';
import { createAdminClient } from '@/lib/db/admin';
import { runMailJob } from '@/lib/mail/dispatch';
import { runCloseReminders } from '@/lib/registrations/reminder-job';
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
 * voor morgen (V15), de wachtrij opruimen, en (fase 7) de maandtotalen van de rapporten bijwerken. Geen sessie: daarom met de secret key (besluit V17).
 * Het antwoord bevat alleen aantallen.
 *
 * Vercel Cron roept dit elk uur aan (vercel.json, besluit V32): met GET, en met CRON_SECRET als
 * Bearer-token. Met de hand starten kan ook met POST.
 */
async function runJob(request: Request) {
  if (!authorized(request)) return new Response('Niet toegestaan', { status: 401, headers: HEADERS });
  try {
    const client = createAdminClient();
    const now = new Date();
    const result = await runMailJob(client, { now, appUrl: `${await siteBaseUrl()}/` });
    // Fase 6 (V61): de herinnering voor het afsluiten van de dag. Mislukt die, dan zijn de mails toch gedaan.
    let dayClose = { groups: 0, devices: 0 };
    try {
      dayClose = await runCloseReminders(client, { now });
    } catch (error) {
      console.error('Herinnering dag afsluiten mislukt', error instanceof Error ? error.message : error);
    }
    // Fase 7: de maandtotalen voor de rapporten bijwerken, zodat de jaarcijfers blijven kloppen als
    // meldingen en uitleen na 24 maanden verdwijnen.
    let monthlyTotals = 0;
    try {
      const refreshed = await client.rpc('refresh_monthly_totals');
      if (refreshed.error) throw new Error(refreshed.error.message);
      monthlyTotals = refreshed.data ?? 0;
    } catch (error) {
      console.error('Maandtotalen bijwerken mislukt', error instanceof Error ? error.message : error);
    }
    return Response.json({ ...result, dayClose, monthlyTotals }, { headers: HEADERS });
  } catch (error) {
    console.error('Taak voor mails mislukt', error instanceof Error ? error.message : error);
    return new Response('Mislukt', { status: 500, headers: HEADERS });
  }
}

export const GET = runJob;
export const POST = runJob;
