import type { PGlite } from '@electric-sql/pglite';
import { beforeAll, describe, expect, it } from 'vitest';
import type { Tables } from '../../src/lib/db/database.types';
import { mapAbsence, mapCurrentEmployees, mapGroup, mapRecurringShift, mapSettings } from '../../src/lib/db/mappers';
import { planImport, type CurrentData } from '../../src/lib/import/plan';
import { parseWorkbook, type RawSheet } from '../../src/lib/import/workbook';
import { createDatabase, createPerson, expectError, session, withSession, type TestPerson } from './helpers';

/** Leest de huidige gegevens zoals de app ze via de API krijgt (datums en tijden als tekst). */
async function loadCurrent(db: PGlite): Promise<CurrentData> {
  const ts = (column: string) => `to_json(${column}) #>> '{}' as ${column}`;
  const settings = await db.query<Tables<'settings'>>(
    `select id, standard_shift_start::text, standard_shift_end::text, saturday_shift_start::text,
            saturday_shift_end::text, day_part_boundary::text, lookahead_weeks, ${ts('updated_at')} from public.settings`,
  );
  const groups = await db.query<Tables<'groups'>>(`select *, ${ts('updated_at')} from public.groups`);
  const employees = await db.query<Tables<'employees'>>(
    `select id, name, group_id, default_role, is_admin, is_active, ${ts('created_at')}, ${ts('updated_at')} from public.employees`,
  );
  const accounts = await db.query<Tables<'employee_accounts'>>(
    'select employee_id, email, user_id from public.employee_accounts',
  );
  const eligibility = await db.query<Tables<'counter_eligibility'>>('select employee_id, group_id from public.counter_eligibility');
  const shifts = await db.query<Tables<'recurring_shifts'>>(
    `select id, employee_id, weekday, group_id, role, start_time::text, end_time::text, valid_from::text,
            valid_to::text, ${ts('created_at')}, ${ts('updated_at')} from public.recurring_shifts`,
  );
  const absences = await db.query<Tables<'absences'>>(
    `select id, employee_id, start_date::text, end_date::text, day_part, status, ${ts('created_at')}, ${ts('updated_at')}
       from public.absences`,
  );
  const settingsRow = settings.rows[0];
  if (!settingsRow) throw new Error('Geen instellingen');
  return {
    settings: mapSettings(settingsRow),
    groups: groups.rows.map(mapGroup),
    employees: mapCurrentEmployees(employees.rows, accounts.rows, eligibility.rows),
    recurringShifts: shifts.rows.map(mapRecurringShift),
    absences: absences.rows.map(mapAbsence),
  };
}

const workbook: RawSheet[] = [
  {
    sheet: 'Medewerkers',
    data: [
      ['Naam', 'E-mail', 'Groep', 'Rol', 'Inzetbaar aan de balie in', 'Beheerder'],
      ['Sanne', 'sanne@voorbeeld.nl', 'Den Bosch', 'balie', 'Den Bosch, Eindhoven', 'nee'],
      ['Anouk', null, 'Logistiek', 'transport', 'Den Bosch', 'nee'],
      ['Anna', 'anna@voorbeeld.nl', 'Overig', null, null, 'nee'],
    ],
  },
  {
    sheet: 'Vaste roosters',
    data: [
      ['Naam', 'Dag', 'Groep', 'Rol', 'Begintijd', 'Eindtijd', 'Geldig vanaf'],
      ['Sanne', 'ma', null, null, null, null, '1-1-2026'],
      ['Anouk', 'di', 'Den Bosch', 'balie', null, null, '1-1-2026'],
      ['Anouk', 'wo', null, null, '08:00', '16:30', '1-1-2026'],
    ],
  },
  {
    sheet: 'Afwezigheid',
    data: [
      ['Naam', 'Van', 'Tot', 'Dagdeel', 'Status'],
      ['Sanne', '14-10-2026', '16-10-2026', null, 'aangevraagd'],
      ['Anouk', '20-10-2026', null, 'ochtend', null],
    ],
  },
];

describe('import in de database', () => {
  let db: PGlite;
  let anna: TestPerson;

  async function plan(raw: RawSheet[]) {
    const current = await loadCurrent(db);
    return planImport(parseWorkbook(raw, current.groups), current, { importingEmployeeId: anna.employeeId });
  }

  async function apply(payload: unknown) {
    return withSession(db, session(anna), async () => {
      const result = await db.query<{ apply_import: Record<string, number> }>('select public.apply_import($1::jsonb)', [
        JSON.stringify(payload),
      ]);
      return result.rows[0]?.apply_import;
    });
  }

  async function counts() {
    const result = await db.query<Record<string, number>>(
      `select (select count(*)::int from public.employees) as employees,
              (select count(*)::int from public.employee_accounts) as accounts,
              (select count(*)::int from public.counter_eligibility) as eligibility,
              (select count(*)::int from public.recurring_shifts) as shifts,
              (select count(*)::int from public.absences) as absences`,
    );
    return result.rows[0];
  }

  beforeAll(async () => {
    db = await createDatabase();
    anna = await createPerson(db, { name: 'Anna', isAdmin: true, role: 'none', groupId: 'other' });
  });

  it('voert het importplan uit in één keer', async () => {
    const first = await plan(workbook);
    expect(first.errors).toEqual([]);
    expect(first.accountsToCreate).toEqual(['Sanne']);
    const result = await apply(first.payload);
    expect(result).toMatchObject({
      employees_created: 2,
      accounts_created: 1,
      shifts_created: 3,
      absences_created: 2,
    });
    expect(await counts()).toEqual({ employees: 3, accounts: 2, eligibility: 3, shifts: 3, absences: 2 });
    const times = await db.query(
      `select start_time::text, end_time::text from public.recurring_shifts where start_time is not null`,
    );
    expect(times.rows).toEqual([{ start_time: '08:00:00', end_time: '16:30:00' }]);
  });

  it('maakt bij opnieuw importeren geen dubbelingen', async () => {
    const second = await plan(workbook);
    expect(second.errors).toEqual([]);
    expect(second.payload).toEqual({ employees: [], shifts: [], absences: [] });
    await apply(second.payload);
    expect(await counts()).toEqual({ employees: 3, accounts: 2, eligibility: 3, shifts: 3, absences: 2 });
  });

  it('beëindigt een vaste dienst als er een nieuwe begint, en logt de import', async () => {
    const next = await plan([
      {
        sheet: 'Vaste roosters',
        data: [
          ['Naam', 'Dag', 'Groep', 'Rol', 'Begintijd', 'Eindtijd', 'Geldig vanaf'],
          ['Sanne', 'ma', 'Breda', null, null, null, '2-11-2026'],
        ],
      },
    ]);
    expect(next.errors).toEqual([]);
    await apply(next.payload);
    const monday = await db.query(
      `select s.group_id, s.valid_from::text, s.valid_to::text from public.recurring_shifts s
         join public.employees e on e.id = s.employee_id
        where e.name = 'Sanne' and s.weekday = 1 order by valid_from`,
    );
    expect(monday.rows).toEqual([
      { group_id: 'den_bosch', valid_from: '2026-01-01', valid_to: '2026-11-01' },
      { group_id: 'breda', valid_from: '2026-11-02', valid_to: null },
    ]);
    const logged = await db.query<{ n: number }>(`select count(*)::int as n from public.audit_log where source = 'import'`);
    expect(logged.rows[0]?.n).toBeGreaterThan(0);
  });

  it('laat alleen een beheerder importeren', async () => {
    const bas = await createPerson(db, { name: 'Bas' });
    await withSession(db, session(bas), async () => {
      await expectError(
        db.query('select public.apply_import($1::jsonb)', [JSON.stringify({ employees: [], shifts: [], absences: [] })]),
        /Alleen een beheerder/,
      );
    });
  });
});
