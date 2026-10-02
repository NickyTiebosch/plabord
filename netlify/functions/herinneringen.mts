/**
 * Geplande taak van Planbord (fase 3), elk uur. Roept de beveiligde route van de app aan: die
 * probeert mislukte mails opnieuw, verstuurt om 16:00 de herinneringen voor morgen en ruimt de
 * wachtrij op. Netlify draait dit alleen op de gepubliceerde site, niet op een deploy preview.
 * `URL` zet Netlify zelf; `CRON_SECRET` stel je in bij de omgevingsvariabelen.
 */
export default async function herinneringen(): Promise<Response> {
  const site = process.env.URL?.replace(/\/+$/, '');
  const secret = process.env.CRON_SECRET?.trim();
  if (!site || !secret) {
    console.error('Planbord-taak: URL of CRON_SECRET ontbreekt.');
    return new Response('Niet ingesteld', { status: 500 });
  }
  const response = await fetch(`${site}/taken/herinneringen`, {
    method: 'POST',
    headers: { authorization: `Bearer ${secret}` },
  });
  if (!response.ok) console.error('Planbord-taak mislukt met status', response.status);
  return new Response(null, { status: response.ok ? 200 : 502 });
}

export const config = { schedule: '@hourly' };
