/**
 * Bundelt de migraties per fase tot één bestand om in de Supabase SQL-editor te plakken:
 * supabase/setup/fase-N.sql. Draai met `npm run db:bundle`.
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
export const MIGRATIONS_DIR = join(root, 'supabase', 'migrations');
export const SETUP_DIR = join(root, 'supabase', 'setup');

interface Phase {
  title: string;
  migrations: string[];
}

export function readPhases(): Record<string, Phase> {
  return JSON.parse(readFileSync(join(SETUP_DIR, 'phases.json'), 'utf8')) as Record<string, Phase>;
}

export function listMigrations(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith('.sql'))
    .sort();
}

export function buildBundle(phaseKey: string): string {
  const phase = readPhases()[phaseKey];
  if (!phase) throw new Error(`Onbekende fase: ${phaseKey}`);
  const header = [
    '-- =====================================================================',
    `-- Planbord · ${phase.title}`,
    '--',
    '-- Plak dit hele bestand in Supabase: SQL Editor → New query → Run.',
    '-- Het is veilig om opnieuw te draaien: bestaande tabellen en gegevens blijven staan.',
    '--',
    '-- Gegenereerd met `npm run db:bundle` uit supabase/migrations. Niet met de hand aanpassen.',
    '-- =====================================================================',
    '',
    'begin;',
    '',
  ].join('\n');
  const body = phase.migrations
    .map((file) => {
      const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8').trim();
      return `-- ---------------------------------------------------------------------\n-- ${file}\n-- ---------------------------------------------------------------------\n\n${sql}\n`;
    })
    .join('\n');
  return `${header}${body}\ncommit;\n`;
}

export function bundlePath(phaseKey: string): string {
  return join(SETUP_DIR, `${phaseKey}.sql`);
}

function main(): void {
  for (const phaseKey of Object.keys(readPhases())) {
    writeFileSync(bundlePath(phaseKey), buildBundle(phaseKey));
    console.log(`Geschreven: supabase/setup/${phaseKey}.sql`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
