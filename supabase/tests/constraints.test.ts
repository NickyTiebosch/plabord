import type { PGlite } from '@electric-sql/pglite';
import { beforeAll, describe, expect, it } from 'vitest';
import { createDatabase, createPerson, expectError, type TestPerson } from './helpers';

describe('constraints', () => {
  let db: PGlite;
  let sanne: TestPerson;

  beforeAll(async () => {
    db = await createDatabase();
    sanne = await createPerson(db, { name: 'Sanne' });
  });

  it('weigert twee vaste diensten op dezelfde weekdag in overlappende periodes', async () => {
    await db.query(
      `insert into public.recurring_shifts (employee_id, weekday, group_id, role, valid_from, valid_to)
       values ($1, 2, 'den_bosch', 'counter', '2026-01-01', '2026-10-31')`,
      [sanne.employeeId],
    );
    await expectError(
      db.query(
        `insert into public.recurring_shifts (employee_id, weekday, group_id, role, valid_from)
         values ($1, 2, 'breda', 'counter', '2026-10-31')`,
        [sanne.employeeId],
      ),
      /recurring_shifts_no_overlap/,
    );
    // Aansluitend (vanaf de dag erna) mag wel, en een andere weekdag ook.
    await db.query(
      `insert into public.recurring_shifts (employee_id, weekday, group_id, role, valid_from)
       values ($1, 2, 'breda', 'counter', '2026-11-01'), ($1, 3, 'den_bosch', 'counter', '2026-01-01')`,
      [sanne.employeeId],
    );
  });

  it('weigert een vaste dienst op zondag of met eindtijd vóór begintijd', async () => {
    await expectError(
      db.query(
        `insert into public.recurring_shifts (employee_id, weekday, group_id, role, valid_from)
         values ($1, 7, 'den_bosch', 'counter', '2026-01-01')`,
        [sanne.employeeId],
      ),
      /recurring_shifts_weekday_range/,
    );
    await expectError(
      db.query(
        `insert into public.recurring_shifts (employee_id, weekday, group_id, role, start_time, end_time, valid_from)
         values ($1, 4, 'den_bosch', 'counter', '18:00', '07:30', '2026-01-01')`,
        [sanne.employeeId],
      ),
      /recurring_shifts_time_order/,
    );
  });

  it('staat een halve dag alleen toe bij één datum', async () => {
    await expectError(
      db.query(
        `insert into public.absences (employee_id, start_date, end_date, day_part)
         values ($1, '2026-10-14', '2026-10-15', 'morning')`,
        [sanne.employeeId],
      ),
      /absences_half_day_single_date/,
    );
  });

  it('weigert dezelfde afwezigheid twee keer', async () => {
    const insert = () =>
      db.query(
        `insert into public.absences (employee_id, start_date, end_date, day_part)
         values ($1, '2026-12-01', '2026-12-05', 'full_day')`,
        [sanne.employeeId],
      );
    await insert();
    await expectError(insert(), /absences_unique/);
  });

  it('eist unieke namen, zonder op hoofdletters te letten', async () => {
    await expectError(
      db.query(`insert into public.employees (name, group_id) values ('SANNE', 'breda')`),
      /employees_name_key/,
    );
    await expectError(
      db.query(`insert into public.employees (name, group_id) values (' Sanne', 'breda')`),
      /employees_name_format/,
    );
  });

  it('bewaart e-mailadressen alleen in kleine letters en uniek', async () => {
    const person = await createPerson(db, { name: 'Joris', email: null });
    await expectError(
      db.query(`insert into public.employee_accounts (employee_id, email) values ($1, 'Joris@Voorbeeld.nl')`, [
        person.employeeId,
      ]),
      /employee_accounts_email_format/,
    );
    await expectError(
      db.query(`insert into public.employee_accounts (employee_id, email) values ($1, 'sanne@voorbeeld.nl')`, [
        person.employeeId,
      ]),
      /employee_accounts_email_key/,
    );
  });

  it('laat alleen vestigingen toe bij inzetbaarheid aan de balie en bij de norm', async () => {
    await db.query(`insert into public.counter_eligibility (employee_id, group_id) values ($1, 'eindhoven')`, [
      sanne.employeeId,
    ]);
    await expectError(
      db.query(`insert into public.counter_eligibility (employee_id, group_id) values ($1, 'logistics')`, [
        sanne.employeeId,
      ]),
      /counter_eligibility_group_fkey/,
    );
    await expectError(
      db.query(`insert into public.staffing_norms (group_id, weekday, day_part, min_staff) values ('other', 1, 'morning', 1)`),
      /staffing_norms_group_fkey/,
    );
  });

  it('eist een vestiging bij een vestigingsfeed en een geldige hash', async () => {
    await expectError(
      db.query(`insert into public.calendar_feeds (employee_id, kind, token_hash) values ($1, 'location', $2)`, [
        sanne.employeeId,
        'd'.repeat(64),
      ]),
      /calendar_feeds_group/,
    );
    await expectError(
      db.query(`insert into public.calendar_feeds (employee_id, kind, token_hash) values ($1, 'personal', 'geheim')`, [
        sanne.employeeId,
      ]),
      /calendar_feeds_token_hash_format/,
    );
  });

  it('staat maar één rij instellingen toe', async () => {
    await expectError(db.query('insert into public.settings (id) values (false)'), /settings_singleton/);
    const count = await db.query<{ n: number }>('select count(*)::int as n from public.settings');
    expect(count.rows[0]?.n).toBe(1);
  });
});
