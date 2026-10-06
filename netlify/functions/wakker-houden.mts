/**
 * Houdt Planbord warm (besluit V31): overdag elke 5 minuten een licht verzoek aan de app, zodat de
 * server niet in slaap valt. Anders duurt de eerste pagina na een rustige periode een paar seconden.
 * De tijden zijn in UTC: van 4:00 tot 22:00 UTC is in Nederland 5:00 tot 23:00 in de winter en
 * 6:00 tot 24:00 in de zomer. Netlify draait dit alleen op de gepubliceerde site, niet op een
 * deploy preview. `URL` zet Netlify zelf.
 */
export default async function wakkerHouden(): Promise<Response> {
  const site = process.env.URL?.replace(/\/+$/, '');
  if (!site) return new Response('Niet ingesteld', { status: 500 });
  const response = await fetch(`${site}/taken/wakker`, { cache: 'no-store' });
  return new Response(null, { status: response.ok ? 200 : 502 });
}

export const config = { schedule: '*/5 4-21 * * *' };
