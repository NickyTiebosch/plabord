/**
 * Het verzoek aan de pushdienst voor één melding naar één toestel (RFC 8030): versleutelde inhoud,
 * het VAPID-token en de vaste headers. Zonder netwerk; het versturen zelf staat in `send.ts`.
 */
import { encryptPayload, fromBase64url, vapidAuthorization, type VapidKeys } from './crypto';
import type { PushContent } from './messages';

export interface PushTarget {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface PushRequest {
  url: string;
  headers: Record<string, string>;
  body: Buffer;
}

/** Hoe lang de pushdienst een melding bewaart als het toestel uit staat: een dag, een test tien minuten. */
export function pushTtl(content: PushContent): number {
  return content.tag.startsWith('test') ? 10 * 60 : 24 * 60 * 60;
}

export function buildPushRequest(target: PushTarget, content: PushContent, keys: VapidKeys, now: Date): PushRequest {
  const body = encryptPayload({
    plaintext: Buffer.from(JSON.stringify(content)),
    userAgentPublicKey: fromBase64url(target.p256dh),
    authSecret: fromBase64url(target.auth),
  });
  return {
    url: target.endpoint,
    headers: {
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      TTL: String(pushTtl(content)),
      Urgency: 'normal',
      Authorization: vapidAuthorization(target.endpoint, keys, now),
    },
    body,
  };
}
