import { createDecipheriv, createECDH, createPublicKey, hkdfSync, randomBytes, verify } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { override, substitution, teamSnapshot, groups } from '../engine/__fixtures__/team';
import { personalDaysFor } from '../mail/messages';
import { encryptPayload, fromBase64url, toBase64url, validVapidKeys, vapidAuthorization, type VapidKeys } from './crypto';
import { isKnownPushEndpoint, isSubscriptionKeys, pushOutcome } from './endpoints';
import { composePush } from './messages';

describe('push: versleuteling volgens RFC 8291', () => {
  it('geeft met de sleutels uit het voorbeeld van de RFC precies dezelfde melding', () => {
    const body = encryptPayload({
      plaintext: Buffer.from('When I grow up, I want to be a watermelon'),
      userAgentPublicKey: fromBase64url(
        'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4',
      ),
      authSecret: fromBase64url('BTBZMqHH6r4Tts7J_aSIgg'),
      serverPrivateKey: fromBase64url('yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw'),
      salt: fromBase64url('DGv6ra1nlYgDCS1FRnbzlw'),
    });
    expect(toBase64url(body)).toBe(
      'DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN',
    );
  });

  it('kan alleen door het toestel zelf worden ontsleuteld', () => {
    const device = createECDH('prime256v1');
    device.generateKeys();
    const authSecret = randomBytes(16);
    const plaintext = Buffer.from(JSON.stringify({ title: 'Planbord', body: 'Je rooster voor di 13 okt is gewijzigd' }));
    const body = encryptPayload({ plaintext, userAgentPublicKey: device.getPublicKey(), authSecret });

    // Ontsleutelen zoals het toestel doet (RFC 8291 §3.4 en RFC 8188 §2), los van de code hierboven.
    const salt = body.subarray(0, 16);
    expect(body.readUInt32BE(16)).toBe(4096);
    const keyLength = body.readUInt8(20);
    const serverPublicKey = body.subarray(21, 21 + keyLength);
    const secret = device.computeSecret(serverPublicKey);
    const keyInfo = Buffer.concat([Buffer.from('WebPush: info\0'), device.getPublicKey(), serverPublicKey]);
    const ikm = Buffer.from(hkdfSync('sha256', secret, authSecret, keyInfo, 32));
    const key = Buffer.from(hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: aes128gcm\0'), 16));
    const nonce = Buffer.from(hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: nonce\0'), 12));
    const encrypted = body.subarray(21 + keyLength);
    const decipher = createDecipheriv('aes-128-gcm', key, nonce);
    decipher.setAuthTag(encrypted.subarray(encrypted.length - 16));
    const record = Buffer.concat([decipher.update(encrypted.subarray(0, encrypted.length - 16)), decipher.final()]);
    expect(record.at(-1)).toBe(2);
    expect(record.subarray(0, record.length - 1).toString()).toBe(plaintext.toString());

    // Een ander toestel kan er niets mee.
    const other = createECDH('prime256v1');
    other.generateKeys();
    expect(other.computeSecret(serverPublicKey)).not.toEqual(secret);
  });

  it('weigert verkeerde sleutels en een te grote melding', () => {
    const device = createECDH('prime256v1');
    device.generateKeys();
    expect(() => encryptPayload({ plaintext: Buffer.from('x'), userAgentPublicKey: Buffer.alloc(10), authSecret: randomBytes(16) })).toThrow();
    expect(() => encryptPayload({ plaintext: Buffer.from('x'), userAgentPublicKey: device.getPublicKey(), authSecret: randomBytes(8) })).toThrow();
    expect(() =>
      encryptPayload({ plaintext: Buffer.alloc(5000), userAgentPublicKey: device.getPublicKey(), authSecret: randomBytes(16) }),
    ).toThrow('te groot');
  });
});

describe('push: het VAPID-token volgens RFC 8292', () => {
  const server = createECDH('prime256v1');
  server.generateKeys();
  const keys: VapidKeys = {
    publicKey: toBase64url(server.getPublicKey()),
    privateKey: toBase64url(server.getPrivateKey()),
    subject: 'mailto:planbord@voorbeeld.nl',
  };
  const now = new Date('2026-10-14T12:00:00Z');

  it('is ondertekend met de privésleutel, voor de pushdienst, en twaalf uur geldig', () => {
    const header = vapidAuthorization('https://fcm.googleapis.com/fcm/send/abc', keys, now);
    const match = /^vapid t=([\w-]+)\.([\w-]+)\.([\w-]+), k=([\w-]+)$/.exec(header);
    expect(match).not.toBeNull();
    const [, head, claims, signature, publicKey] = match ?? [];
    expect(JSON.parse(fromBase64url(head ?? '').toString())).toEqual({ typ: 'JWT', alg: 'ES256' });
    expect(JSON.parse(fromBase64url(claims ?? '').toString())).toEqual({
      aud: 'https://fcm.googleapis.com',
      exp: Math.floor(now.getTime() / 1000) + 12 * 60 * 60,
      sub: 'mailto:planbord@voorbeeld.nl',
    });
    expect(publicKey).toBe(keys.publicKey);
    const point = server.getPublicKey();
    const key = createPublicKey({
      key: { kty: 'EC', crv: 'P-256', x: toBase64url(point.subarray(1, 33)), y: toBase64url(point.subarray(33)) },
      format: 'jwk',
    });
    expect(verify('sha256', Buffer.from(`${head}.${claims}`), { key, dsaEncoding: 'ieee-p1363' }, fromBase64url(signature ?? ''))).toBe(true);
  });

  it('controleert de vorm van de sleutels', () => {
    expect(validVapidKeys(keys)).toBe(true);
    expect(validVapidKeys({ ...keys, subject: 'planbord' })).toBe(false);
    expect(validVapidKeys({ ...keys, privateKey: 'kort' })).toBe(false);
    expect(validVapidKeys({ ...keys, publicKey: toBase64url(randomBytes(65)) })).toBe(false);
    expect(() => vapidAuthorization('https://fcm.googleapis.com/x', { ...keys, subject: '' }, now)).toThrow();
  });
});

describe('push: waarheen, en wat het antwoord betekent', () => {
  it('stuurt alleen naar https-adressen van de bekende pushdiensten', () => {
    for (const endpoint of [
      'https://fcm.googleapis.com/fcm/send/abc',
      'https://web.push.apple.com/QGy3T9ghqb',
      'https://updates.push.services.mozilla.com/wpush/v2/gAAAAA',
      'https://wns2-par02p.notify.windows.com/w/?token=BQYAAAB',
    ]) {
      expect(isKnownPushEndpoint(endpoint)).toBe(true);
    }
    for (const endpoint of [
      'http://fcm.googleapis.com/fcm/send/abc',
      'https://voorbeeld.nl/push',
      'https://fcm.googleapis.com.voorbeeld.nl/x',
      'https://localhost/push',
      `https://fcm.googleapis.com/${'x'.repeat(1100)}`,
    ]) {
      expect(isKnownPushEndpoint(endpoint)).toBe(false);
    }
  });

  it('herkent de sleutels van een toestel', () => {
    const device = createECDH('prime256v1');
    device.generateKeys();
    expect(isSubscriptionKeys(toBase64url(device.getPublicKey()), toBase64url(randomBytes(16)))).toBe(true);
    expect(isSubscriptionKeys('kort', toBase64url(randomBytes(16)))).toBe(false);
    expect(isSubscriptionKeys(toBase64url(device.getPublicKey()), 'a+b/c=')).toBe(false);
  });

  it('ruimt een abonnement alleen op als de pushdienst zegt dat het weg is', () => {
    expect([201, 202, 404, 410, 400, 403, 413, 429, 500].map(pushOutcome)).toEqual([
      'sent',
      'sent',
      'gone',
      'gone',
      'failed',
      'failed',
      'failed',
      'failed',
      'failed',
    ]);
  });
});

describe('push: de tekst (V26)', () => {
  const snapshot = teamSnapshot({
    substitutions: [substitution('s1', 'danique', '2026-10-12', 'den_bosch', ['afternoon'])],
    shiftOverrides: [
      override('o1', 'sanne', '2026-10-14', { kind: 'off' }),
      override('o2', 'bram', '2026-10-15', { kind: 'shift', groupId: 'eindhoven', role: 'counter' }),
    ],
  });
  const push = (kind: Parameters<typeof composePush>[0]['kind'], employeeId: string, dates: string[]) =>
    composePush({ kind, days: personalDaysFor(snapshot, employeeId, dates), groups });

  it('noemt bij een inval de dag, de plaats en de tijden', () => {
    expect(push('substitution_assigned', 'danique', ['2026-10-12'])).toEqual({
      title: 'Planbord',
      body: 'Je valt in op ma 12 okt in Den Bosch (13:00–18:00)',
      url: '/',
      tag: 'substitution_assigned-2026-10-12',
    });
  });

  it('zegt wanneer een inval niet doorgaat, en spreekt zichzelf nooit tegen', () => {
    expect(push('substitution_cancelled', 'joris', ['2026-10-13']).body).toBe('Je inval op di 13 okt gaat niet door');
    // Staat er toch (weer) een inval, dan wordt het een gewone wijziging.
    expect(push('substitution_cancelled', 'danique', ['2026-10-12']).body).toBe(
      'Je rooster voor ma 12 okt is gewijzigd: Backoffice 07:30–13:00, invallen in Den Bosch 13:00–18:00',
    );
    expect(push('substitution_assigned', 'sanne', ['2026-10-13']).body).toBe('Je rooster voor di 13 okt is gewijzigd: Den Bosch 07:30–18:00');
  });

  it('vat een gewijzigde dag kort samen', () => {
    expect(push('day_changed', 'sanne', ['2026-10-14']).body).toBe('Je rooster voor wo 14 okt is gewijzigd: geen dienst');
    expect(push('day_changed', 'bram', ['2026-10-15']).body).toBe('Je rooster voor do 15 okt is gewijzigd: Eindhoven 07:30–18:00');
    expect(push('day_changed', 'sanne', ['2026-10-14', '2026-10-15']).body).toBe('Je rooster voor wo 14 okt en do 15 okt is gewijzigd');
  });

  it('herinnert de dag ervoor, en heeft een testmelding', () => {
    expect(push('reminder', 'bram', ['2026-10-15']).body).toBe('Morgen wijkt je rooster af: Eindhoven 07:30–18:00');
    expect(composePush({ kind: 'test', days: [], groups })).toMatchObject({
      body: 'Testmelding: meldingen op dit toestel werken.',
      tag: 'test-test',
    });
  });

  it('noemt geen collega’s en blijft kort', () => {
    const body = push('substitution_assigned', 'danique', ['2026-10-12']).body;
    for (const name of ['Sanne', 'Joris', 'Bram', 'Lotte']) expect(body).not.toContain(name);
    const dates = Array.from({ length: 40 }, (_, index) => `2026-11-${String((index % 28) + 1).padStart(2, '0')}`);
    expect(push('day_changed', 'sanne', dates).body.length).toBeLessThanOrEqual(180);
  });
});
