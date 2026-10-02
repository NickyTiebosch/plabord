import 'server-only';
import { validVapidKeys, type VapidKeys } from './crypto';
import { isKnownPushEndpoint, pushOutcome, type PushOutcome } from './endpoints';
import type { PushContent } from './messages';
import { buildPushRequest, type PushTarget } from './request';

/**
 * Versturen naar de pushdienst van een toestel (fase 4). De sleutels komen uit de omgeving en
 * worden pas hier gelezen, zodat de build zonder sleutels slaagt. Zonder sleutels gaat er geen
 * push weg; de mails gaan gewoon door. Tests geven een eigen afzender en versturen nooit echt.
 */

export type PushSender = (target: PushTarget, content: PushContent) => Promise<PushOutcome>;

/** De VAPID-sleutels uit de omgeving, of `null` als ze ontbreken of niet kloppen. */
export function vapidKeysFromEnv(): VapidKeys | null {
  const publicKey = process.env.VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  const subject = process.env.VAPID_SUBJECT?.trim();
  if (!publicKey || !privateKey || !subject) return null;
  const keys = { publicKey, privateKey, subject };
  return validVapidKeys(keys) ? keys : null;
}

/** De publieke sleutel voor het aanmelden van een toestel, of `null` als push niet is ingesteld. */
export function vapidPublicKey(): string | null {
  return vapidKeysFromEnv()?.publicKey ?? null;
}

/** Een afzender met de sleutels uit de omgeving, of `null` als push niet is ingesteld. */
export function webPushSender(): PushSender | null {
  const keys = vapidKeysFromEnv();
  if (!keys) return null;
  return async (target, content) => {
    // Ook al bewaakt de database dit: nooit naar een ander adres dan een bekende pushdienst.
    if (!isKnownPushEndpoint(target.endpoint)) return 'failed';
    try {
      const request = buildPushRequest(target, content, keys, new Date());
      const response = await fetch(request.url, {
        method: 'POST',
        headers: request.headers,
        body: new Uint8Array(request.body),
        redirect: 'error',
        signal: AbortSignal.timeout(10_000),
      });
      const outcome = pushOutcome(response.status);
      // Nooit het adres loggen: daarin zit het toestel.
      if (outcome === 'failed') console.error('Push mislukt met status', response.status);
      return outcome;
    } catch (error) {
      console.error('Push mislukt', error instanceof Error ? error.name : 'fout');
      return 'failed';
    }
  };
}
