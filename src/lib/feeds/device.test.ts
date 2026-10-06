import { describe, expect, it } from 'vitest';
import { isAndroid } from './device';

const request = (userAgent: string | null, platform?: string) => {
  const headers = new Headers();
  if (userAgent !== null) headers.set('user-agent', userAgent);
  if (platform !== undefined) headers.set('sec-ch-ua-platform', platform);
  return headers;
};

describe('Android herkennen', () => {
  it('herkent Chrome, Samsung Internet en Firefox op Android, ook op een tablet', () => {
    const chrome =
      'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36';
    const samsung =
      'Mozilla/5.0 (Linux; Android 14; SAMSUNG SM-S921B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/27.0 Chrome/125.0.0.0 Mobile Safari/537.36';
    const firefox = 'Mozilla/5.0 (Android 15; Mobile; rv:143.0) Gecko/143.0 Firefox/143.0';
    const tablet = 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';
    expect(isAndroid(request(chrome, '"Android"'))).toBe(true);
    expect(isAndroid(request(samsung, '"Android"'))).toBe(true);
    expect(isAndroid(request(firefox))).toBe(true);
    expect(isAndroid(request(tablet, '"Android"'))).toBe(true);
  });

  it('herkent Android aan de hint van Chrome, ook als de user-agent die van een computer is', () => {
    const desktop = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';
    expect(isAndroid(request(desktop, '"Android"'))).toBe(true);
    expect(isAndroid(request(null, 'Android'))).toBe(true);
  });

  it('ziet een iPhone, iPad of computer niet als Android', () => {
    const iphone =
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1';
    const chromeOnIphone =
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/141.0.7390.41 Mobile/15E148 Safari/604.1';
    const ipad = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15';
    const windows =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';
    expect(isAndroid(request(iphone))).toBe(false);
    expect(isAndroid(request(chromeOnIphone))).toBe(false);
    expect(isAndroid(request(ipad))).toBe(false);
    expect(isAndroid(request(windows, '"Windows"'))).toBe(false);
  });

  it('gaat zonder kopteksten uit van geen Android', () => {
    expect(isAndroid(request(null))).toBe(false);
    expect(isAndroid(request('', '""'))).toBe(false);
  });
});
