import { readFileSync } from 'node:fs';
import type { PGlite } from '@electric-sql/pglite';
import { beforeAll, describe, expect, it } from 'vitest';
import { buildBundle, bundlePath, listMigrations, readPhases } from '../../scripts/bundle-sql.ts';
import { createDatabase, setupSql } from './helpers';

describe('SQL-bundel', () => {
  it('is gelijk aan de migraties (anders: npm run db:bundle)', () => {
    for (const phase of Object.keys(readPhases())) {
      expect(readFileSync(bundlePath(phase), 'utf8')).toBe(buildBundle(phase));
    }
  });

  it('bevat elke migratie precies één keer', () => {
    const inPhases = Object.values(readPhases()).flatMap((phase) => phase.migrations);
    expect(new Set(inPhases).size).toBe(inPhases.length);
    expect([...inPhases].sort()).toEqual(listMigrations());
  });
});

describe('database na de setup', () => {
  let db: PGlite;

  beforeAll(async () => {
    db = await createDatabase();
  });

  it('kan de bundel nog een keer draaien zonder fouten of dubbele seed', async () => {
    await db.exec(setupSql());
    const counts = await db.query<{ groups: number; settings: number; norms: number }>(
      `select (select count(*)::int from public.groups) as groups,
              (select count(*)::int from public.settings) as settings,
              (select count(*)::int from public.staffing_norms) as norms`,
    );
    expect(counts.rows[0]).toEqual({ groups: 6, settings: 1, norms: 36 });
  });

  it('heeft RLS aan op elke tabel in public', async () => {
    const result = await db.query<{ relname: string }>(
      `select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity`,
    );
    expect(result.rows).toEqual([]);
  });

  it('geeft anon geen enkel recht op tabellen of kolommen', async () => {
    const tables = await db.query(
      `select table_name, privilege_type from information_schema.role_table_grants
        where grantee = 'anon' and table_schema = 'public'`,
    );
    const columns = await db.query(
      `select table_name, column_name from information_schema.column_privileges
        where grantee = 'anon' and table_schema = 'public'`,
    );
    expect(tables.rows).toEqual([]);
    expect(columns.rows).toEqual([]);
  });

  it('laat anon geen functies uitvoeren in public of private', async () => {
    const result = await db.query<{ proname: string }>(
      `select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname in ('public', 'private') and has_function_privilege('anon', p.oid, 'execute')`,
    );
    expect(result.rows).toEqual([]);
  });

  it('geeft authenticated geen delete op medewerkers en geen schrijfrechten op het logboek', async () => {
    const result = await db.query<{ table_name: string; privilege_type: string }>(
      `select table_name, privilege_type from information_schema.role_table_grants
        where grantee = 'authenticated' and table_schema = 'public'
          and ((table_name = 'employees' and privilege_type = 'DELETE')
            or (table_name = 'audit_log' and privilege_type <> 'SELECT'))`,
    );
    expect(result.rows).toEqual([]);
  });

  it('zet de seed uit de opdracht', async () => {
    const groups = await db.query(
      'select id, name, has_counter, substitution_rank from public.groups order by sort_order',
    );
    expect(groups.rows).toEqual([
      { id: 'den_bosch', name: 'Den Bosch', has_counter: true, substitution_rank: 3 },
      { id: 'eindhoven', name: 'Eindhoven', has_counter: true, substitution_rank: 3 },
      { id: 'breda', name: 'Breda', has_counter: true, substitution_rank: 3 },
      { id: 'logistics', name: 'Logistiek', has_counter: false, substitution_rank: 4 },
      { id: 'backoffice', name: 'Backoffice', has_counter: false, substitution_rank: 1 },
      { id: 'other', name: 'Overig', has_counter: false, substitution_rank: 2 },
    ]);
    const settings = await db.query(
      `select standard_shift_start::text, standard_shift_end::text, saturday_shift_start::text,
              saturday_shift_end::text, day_part_boundary::text, lookahead_weeks from public.settings`,
    );
    expect(settings.rows).toEqual([
      {
        standard_shift_start: '07:30:00',
        standard_shift_end: '18:00:00',
        saturday_shift_start: '07:30:00',
        saturday_shift_end: '18:00:00',
        day_part_boundary: '13:00:00',
        lookahead_weeks: 8,
      },
    ]);
    const norms = await db.query<{ weekday: number; min_staff: number; n: number }>(
      `select weekday, min_staff, count(*)::int as n from public.staffing_norms
        group by weekday, min_staff order by weekday`,
    );
    expect(norms.rows).toEqual([
      { weekday: 1, min_staff: 2, n: 6 },
      { weekday: 2, min_staff: 2, n: 6 },
      { weekday: 3, min_staff: 2, n: 6 },
      { weekday: 4, min_staff: 2, n: 6 },
      { weekday: 5, min_staff: 2, n: 6 },
      { weekday: 6, min_staff: 0, n: 6 },
    ]);
  });
});
