import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { sessionCookieOptions } from './lib/env';

/** Pagina's die je zonder inloggen mag zien. De uitleg (V30) is voor wie nog geen account heeft. */
const PUBLIC_PATHS = ['/inloggen', '/uitleg'];

function isPublic(path: string): boolean {
  return PUBLIC_PATHS.some((publicPath) => path === publicPath || path.startsWith(`${publicPath}/`));
}

/**
 * Ververst bij elk verzoek de sessie (zodat je lang ingelogd blijft) en stuurt wie niet
 * is ingelogd naar /inloggen. De pagina's controleren daarna zelf nog een keer.
 *
 * Bewust middleware.ts (edge-runtime) en niet proxy.ts van Next.js 16: Netlify kan een
 * proxy.ts (Node-runtime) nu niet verpakken. Zie opennextjs/opennextjs-netlify#3171, #3562
 * en #3575. Zijn die opgelost, dan kan dit bestand terug naar proxy.ts met een export "proxy".
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  // Zonder configuratie tonen de pagina's zelf een duidelijke foutmelding.
  if (!url || !key) return response;

  const supabase = createServerClient(url, key, {
    cookieOptions: sessionCookieOptions(),
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
        for (const [header, value] of Object.entries(headers)) response.headers.set(header, value);
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const path = request.nextUrl.pathname;
  if (!data?.claims && !isPublic(path)) {
    const target = request.nextUrl.clone();
    target.pathname = '/inloggen';
    target.search = '';
    if (path !== '/') target.searchParams.set('volgende', `${path}${request.nextUrl.search}`);
    const redirect = NextResponse.redirect(target);
    for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
    return redirect;
  }
  return response;
}

export const config = {
  // Niet voor statische bestanden, iconen, het manifest, de service worker voor meldingen, de
  // agendafeeds (die hebben een eigen token), de geplande taak (die heeft CRON_SECRET) en de video's
  // en de PDF van de uitleg (public/uitleg). De pagina /uitleg zelf gaat wel door de middleware.
  matcher: [
    '/((?!_next/static|_next/image|feed/|taken/|icons/|uitleg/|favicon.ico|icon|apple-icon|manifest.webmanifest|robots.txt|sw.js).*)',
  ],
};
