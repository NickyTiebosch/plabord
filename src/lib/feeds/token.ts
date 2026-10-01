import { createHash, randomBytes } from 'node:crypto';

const TOKEN_BYTES = 32;
/** 32 bytes als base64url: 43 tekens. */
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

/** Een nieuw geheim token (32 willekeurige bytes) en de hash die we opslaan. */
export function createFeedToken(): { token: string; hash: string } {
  const token = randomBytes(TOKEN_BYTES).toString('base64url');
  return { token, hash: hashFeedToken(token) };
}

export function hashFeedToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

export function isFeedToken(value: string): boolean {
  return TOKEN_PATTERN.test(value);
}

/** Haalt het token uit een bestandsnaam zoals "abc….ics". */
export function tokenFromFileName(file: string): string | null {
  const token = file.endsWith('.ics') ? file.slice(0, -4) : file;
  return isFeedToken(token) ? token : null;
}

export function feedUrls(baseUrl: string, token: string): { https: string; webcal: string } {
  const https = `${baseUrl.replace(/\/+$/, '')}/feed/${token}.ics`;
  return { https, webcal: https.replace(/^https?:\/\//, 'webcal://') };
}
