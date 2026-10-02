/**
 * Waar Planbord een push heen mag sturen (fase 4, V28). Alleen https-adressen van de bekende
 * pushdiensten van Apple, Google, Mozilla en Microsoft; dezelfde regel staat als controle in de
 * database. Zo kan niemand de server een ander adres laten aanroepen. Puur.
 */
const KNOWN_PUSH_SERVICE =
  /^https:\/\/(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|[a-z0-9-]+\.push\.apple\.com|[a-z0-9-]+\.notify\.windows\.com)\//;

export function isKnownPushEndpoint(endpoint: string): boolean {
  return endpoint.length <= 1024 && KNOWN_PUSH_SERVICE.test(endpoint);
}

/** De sleutels van een toestel in de vorm die een browser geeft (base64url, 65 en 16 bytes). */
export function isSubscriptionKeys(p256dh: string, auth: string): boolean {
  return /^[A-Za-z0-9_-]{86,88}$/.test(p256dh) && /^[A-Za-z0-9_-]{22,24}$/.test(auth);
}

export type PushOutcome = 'sent' | 'gone' | 'failed';

/**
 * Wat een antwoord van de pushdienst betekent. 404 en 410: het abonnement bestaat niet meer, dus
 * Planbord verwijdert het. Al het andere dat geen succes is, is mislukt; dat proberen we niet opnieuw.
 */
export function pushOutcome(status: number): PushOutcome {
  if (status >= 200 && status < 300) return 'sent';
  if (status === 404 || status === 410) return 'gone';
  return 'failed';
}
