import { describe, expect, it } from 'vitest';
import { createFeedToken, feedUrls, hashFeedToken, isFeedToken, tokenFromFileName } from './token';

describe('agendatokens', () => {
  it('maakt tokens van 32 willekeurige bytes en bewaart alleen een SHA-256-hash', () => {
    const first = createFeedToken();
    const second = createFeedToken();
    expect(Buffer.from(first.token, 'base64url')).toHaveLength(32);
    expect(first.token).not.toBe(second.token);
    expect(first.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(first.hash).toBe(hashFeedToken(first.token));
    expect(first.hash).not.toContain(first.token);
  });

  it('leest het token uit de bestandsnaam en weigert rare invoer', () => {
    const { token } = createFeedToken();
    expect(tokenFromFileName(`${token}.ics`)).toBe(token);
    expect(tokenFromFileName('kort.ics')).toBeNull();
    expect(tokenFromFileName(`${token}/../x.ics`)).toBeNull();
    expect(isFeedToken(token)).toBe(true);
  });

  it('maakt een https- en een webcal-link', () => {
    expect(feedUrls('https://planbord.netlify.app/', 'abc')).toEqual({
      https: 'https://planbord.netlify.app/feed/abc.ics',
      webcal: 'webcal://planbord.netlify.app/feed/abc.ics',
    });
  });
});
