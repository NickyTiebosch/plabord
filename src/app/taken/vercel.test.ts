import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

const ROOT = new URL('../../../', import.meta.url);
const read = (path: string) => fs.readFileSync(new URL(path, ROOT), 'utf8');
const config = JSON.parse(read('vercel.json')) as {
  regions?: string[];
  buildCommand?: string;
  crons?: { path: string; schedule: string }[];
};

describe('vercel.json (besluit V32)', () => {
  it('draait de server in Frankfurt, naast de database', () => {
    expect(config.regions).toEqual(['fra1']);
  });

  it('bouwt zonder telemetrie van Next.js', () => {
    expect(config.buildCommand).toMatch(/^NEXT_TELEMETRY_DISABLED=1 /);
  });

  it('start de herinneringen elk uur en houdt de server overdag warm', () => {
    expect(config.crons).toEqual([
      { path: '/taken/herinneringen', schedule: '0 * * * *' },
      { path: '/taken/wakker', schedule: '*/5 4-21 * * *' },
    ]);
  });

  it('heeft voor elke geplande taak een route met GET, want Vercel Cron gebruikt GET', () => {
    for (const cron of config.crons ?? []) {
      const path = `src/app${cron.path}/route.ts`;
      expect(fs.existsSync(new URL(path, ROOT)), path).toBe(true);
      expect(read(path), path).toMatch(/export (async )?function GET\b|export const GET\b/);
    }
  });

  it('laat de geplande taken buiten de proxy: die hebben geen sessie', () => {
    expect(read('src/proxy.ts')).toMatch(/\|taken\/\|/);
  });

  it('heeft geen Netlify-bestanden meer', () => {
    expect(fs.existsSync(new URL('netlify.toml', ROOT))).toBe(false);
    expect(fs.existsSync(new URL('netlify/', ROOT))).toBe(false);
  });
});
