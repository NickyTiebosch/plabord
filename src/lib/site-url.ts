import 'server-only';
import { headers } from 'next/headers';
import { configuredSiteUrl } from './env';

/** De basis-URL voor links naar buiten, zoals agendalinks: SITE_URL, of het adres van dit verzoek. */
export async function siteBaseUrl(): Promise<string> {
  const configured = configuredSiteUrl();
  if (configured) return configured;
  const list = await headers();
  const host = list.get('x-forwarded-host') ?? list.get('host') ?? 'localhost:3000';
  const proto = list.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
  return `${proto.split(',')[0]?.trim() ?? 'https'}://${host.split(',')[0]?.trim() ?? host}`;
}
