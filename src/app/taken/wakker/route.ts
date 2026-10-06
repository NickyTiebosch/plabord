export const dynamic = 'force-dynamic';

/**
 * Houdt de server van Planbord warm (besluit V31). Vercel Cron roept dit overdag elke 5 minuten aan
 * (vercel.json). Zonder bezoek legt de host de server na een tijdje stil, en dan duurt de eerste
 * pagina langer. Deze route doet verder niets: geen database, geen gegevens, dus ook geen geheim.
 */
export function GET() {
  return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' } });
}
