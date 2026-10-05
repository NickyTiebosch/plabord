/**
 * Web push zonder extern pakket (fase 4, zie CLAUDE.md): de versleuteling volgens RFC 8291
 * (aes128gcm uit RFC 8188) en het VAPID-token volgens RFC 8292, met `node:crypto`. Alleen op de
 * server gebruiken. Met een vaste sleutel en salt is de uitkomst altijd gelijk; dat gebruiken de tests.
 */
import { createCipheriv, createECDH, createPrivateKey, hkdfSync, randomBytes, sign } from 'node:crypto';

export function toBase64url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64url');
}

export function fromBase64url(text: string): Buffer {
  return Buffer.from(text, 'base64url');
}

/** Een publieke P-256-sleutel in de vorm van web push: 65 bytes, beginnend met 0x04. */
export function isPublicKey(bytes: Uint8Array): boolean {
  return bytes.length === 65 && bytes[0] === 0x04;
}

export interface EncryptInput {
  plaintext: Uint8Array;
  /** De publieke sleutel van het toestel (`p256dh`), 65 bytes. */
  userAgentPublicKey: Uint8Array;
  /** Het geheim van het toestel (`auth`), 16 bytes. */
  authSecret: Uint8Array;
  /** Alleen voor tests: een vaste eigen sleutel (32 bytes). Anders elke keer een nieuwe. */
  serverPrivateKey?: Uint8Array;
  /** Alleen voor tests: een vaste salt (16 bytes). Anders willekeurig. */
  salt?: Uint8Array;
  /** De recordgrootte uit RFC 8188; de hele melding past in één record. */
  recordSize?: number;
}

const DEFAULT_RECORD_SIZE = 4096;

/** Versleutelt één melding voor één toestel (RFC 8291). Geeft de body voor de pushdienst. */
export function encryptPayload(input: EncryptInput): Buffer {
  const recordSize = input.recordSize ?? DEFAULT_RECORD_SIZE;
  const userAgentPublicKey = Buffer.from(input.userAgentPublicKey);
  const authSecret = Buffer.from(input.authSecret);
  if (!isPublicKey(userAgentPublicKey)) throw new Error('Ongeldige sleutel van het toestel');
  if (authSecret.length !== 16) throw new Error('Ongeldig geheim van het toestel');

  const ecdh = createECDH('prime256v1');
  if (input.serverPrivateKey) ecdh.setPrivateKey(Buffer.from(input.serverPrivateKey));
  else ecdh.generateKeys();
  const serverPublicKey = ecdh.getPublicKey();
  const sharedSecret = ecdh.computeSecret(userAgentPublicKey);

  // RFC 8291 §3.4: eerst het geheim van het toestel erbij, dan de sleutel en nonce voor deze melding.
  const keyInfo = Buffer.concat([Buffer.from('WebPush: info\0', 'latin1'), userAgentPublicKey, serverPublicKey]);
  const ikm = Buffer.from(hkdfSync('sha256', sharedSecret, authSecret, keyInfo, 32));
  const salt = Buffer.from(input.salt ?? randomBytes(16));
  const contentKey = Buffer.from(hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: aes128gcm\0', 'latin1'), 16));
  const nonce = Buffer.from(hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: nonce\0', 'latin1'), 12));

  // Eén record: de tekst, dan 0x02 (laatste record), zonder opvulling.
  const record = Buffer.concat([Buffer.from(input.plaintext), Buffer.from([2])]);
  if (record.length + 16 > recordSize) throw new Error('De melding is te groot');
  const cipher = createCipheriv('aes-128-gcm', contentKey, nonce);
  const encrypted = Buffer.concat([cipher.update(record), cipher.final(), cipher.getAuthTag()]);

  // RFC 8188 §2.1: salt (16) · recordgrootte (4) · lengte sleutel (1) · eigen publieke sleutel (65).
  const header = Buffer.alloc(21);
  salt.copy(header, 0);
  header.writeUInt32BE(recordSize, 16);
  header.writeUInt8(serverPublicKey.length, 20);
  return Buffer.concat([header, serverPublicKey, encrypted]);
}

export interface VapidKeys {
  /** De publieke sleutel, base64url (65 bytes). */
  publicKey: string;
  /** De privésleutel, base64url (32 bytes). Alleen op de server. */
  privateKey: string;
  /** Contact voor de pushdienst: `mailto:` of `https:`. */
  subject: string;
}

/** Klopt de vorm van de sleutels? Zo niet, dan versturen we niets. */
export function validVapidKeys(keys: VapidKeys): boolean {
  return (
    isPublicKey(fromBase64url(keys.publicKey)) &&
    fromBase64url(keys.privateKey).length === 32 &&
    /^(mailto:|https:\/\/)\S+$/.test(keys.subject)
  );
}

/** Het VAPID-token voor één pushdienst (RFC 8292), voor de header `Authorization`. */
export function vapidAuthorization(endpoint: string, keys: VapidKeys, now: Date, validSeconds = 12 * 60 * 60): string {
  const publicKey = fromBase64url(keys.publicKey);
  if (!validVapidKeys(keys)) throw new Error('Ongeldige VAPID-sleutels');
  const header = toBase64url(Buffer.from(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const claims = toBase64url(
    Buffer.from(
      JSON.stringify({
        aud: new URL(endpoint).origin,
        exp: Math.floor(now.getTime() / 1000) + validSeconds,
        sub: keys.subject,
      }),
    ),
  );
  const unsigned = `${header}.${claims}`;
  const key = createPrivateKey({
    key: {
      kty: 'EC',
      crv: 'P-256',
      d: keys.privateKey,
      x: toBase64url(publicKey.subarray(1, 33)),
      y: toBase64url(publicKey.subarray(33, 65)),
    },
    format: 'jwk',
  });
  const signature = sign('sha256', Buffer.from(unsigned), { key, dsaEncoding: 'ieee-p1363' });
  return `vapid t=${unsigned}.${toBase64url(signature)}, k=${keys.publicKey}`;
}
