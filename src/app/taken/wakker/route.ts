export const dynamic = 'force-dynamic';

/**
 * Houdt de server van Planbord warm (besluit V31). netlify/functions/wakker-houden.mts roept dit
 * overdag elke 5 minuten aan. Zonder bezoek legt Netlify de server na een tijdje stil, en dan duurt
 * de eerste pagina een paar seconden. Deze route doet verder niets: geen database, geen gegevens.
 */
export function GET() {
  return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' } });
}
