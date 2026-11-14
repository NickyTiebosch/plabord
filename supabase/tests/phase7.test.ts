import type { PGlite } from '@electric-sql/pglite';
import { beforeAll, describe, expect, it } from 'vitest';
import { createDatabase, createPerson, expectError, session, withSession, type TestPerson } from './helpers';

describe('fase 7: rapporten en signalen', () => {
  let db: PGlite;
  let anna: TestPerson; // beheerder
  let tess: TestPerson; // teamleider
  let bas: TestPerson; // medewerker
  let vw: string;
  let audi: string;

  const as = <T>(person: TestPerson, run: () => Promise<T>) => withSession(db, session(person), run);
  const value = async <T>(sql: string, params: unknown[] = []) => (await db.query<{ v: T }>(sql, params)).rows[0]?.v;

  beforeAll(async () => {
    db = await createDatabase();
    anna = await createPerson(db, { name: 'Anna', isAdmin: true, role: 'none', groupId: 'other' });
    tess = await createPerson(db, { name: 'Tess', role: 'none', groupId: 'other' });
    bas = await createPerson(db, { name: 'Bas' });
    await db.query('update public.employees set is_team_lead = true where id = $1', [tess.employeeId]);
    vw = (await value<string>(`select id as v from public.workshops where group_id = 'den_bosch' and name = 'Volkswagen'`)) ?? '';
    audi = (await value<string>(`select id as v from public.workshops where group_id = 'den_bosch' and name = 'Audi'`)) ?? '';
    // Als postgres, zoals het inlezen: binnenvallers en meldingen in twee maanden.
    await db.query(
      `insert into public.walk_ins (group_id, workshop_id, date, count) values
         ('den_bosch', $1, '2026-10-05', 3), ('den_bosch', $1, '2026-10-06', 2), ('den_bosch', $2, '2026-10-06', 4),
         ('den_bosch', $1, '2026-11-02', 5)`,
      [vw, audi],
    );
    await db.query(
      `insert into public.incident_reports (group_id, workshop_id, occurred_at, kind, cancelled_at, charge, charged_at, charged_by) values
         ('den_bosch', $1, '2026-10-05 10:00+02', 'cancellation', '11:30', true, now(), $2),
         ('den_bosch', $1, '2026-10-06 10:00+02', 'cancellation', '09:00', false, null, null),
         ('den_bosch', $1, '2026-11-02 10:00+01', 'cancellation', '12:00', true, null, null)`,
      [vw, anna.employeeId],
    );
    await db.query(
      `insert into public.incident_reports (group_id, workshop_id, occurred_at, kind) values ('den_bosch', $1, '2026-11-03 10:00+01', 'late_return')`,
      [audi],
    );
  });

  it('telt binnenvallers per maand, week en jaar, alleen voor beheerder en teamleider', async () => {
    const months = await as(tess, () =>
      db.query(`select bucket::text, workshop_id, total from public.report_walk_ins('month', '2026-10-01', '2026-11-30') order by bucket, total`),
    );
    expect(months.rows).toEqual([
      { bucket: '2026-10-01', workshop_id: audi, total: 4 },
      { bucket: '2026-10-01', workshop_id: vw, total: 5 },
      { bucket: '2026-11-01', workshop_id: vw, total: 5 },
    ]);
    const weeks = await as(anna, () => db.query(`select bucket::text from public.report_walk_ins('week', '2026-10-01', '2026-11-30') group by bucket order by bucket`));
    expect(weeks.rows).toEqual([{ bucket: '2026-10-05' }, { bucket: '2026-11-02' }]);
    const year = await as(anna, () => value<number>(`select sum(total)::int as v from public.report_walk_ins('year', '2026-01-01', '2026-12-31')`));
    expect(year).toBe(14);
    await as(bas, () => expectError(db.query(`select * from public.report_walk_ins('month', '2026-10-01', '2026-11-30')`), /beheerder of teamleider/));
    await as(tess, () => expectError(db.query(`select * from public.report_walk_ins('dag', '2026-10-01', '2026-11-30')`), /geldige periode/));
  });

  it('telt meldingen per soort, met door te belasten en doorbelast', async () => {
    const rows = await as(tess, () =>
      db.query(
        `select bucket::text, kind, total, chargeable, charged from public.report_incidents('month', '2026-10-01', '2026-11-30') order by bucket, kind`,
      ),
    );
    expect(rows.rows).toEqual([
      { bucket: '2026-10-01', kind: 'cancellation', total: 2, chargeable: 1, charged: 1 },
      { bucket: '2026-11-01', kind: 'cancellation', total: 1, chargeable: 1, charged: 0 },
      { bucket: '2026-11-01', kind: 'late_return', total: 1, chargeable: 0, charged: 0 },
    ]);
    await as(bas, () => expectError(db.query(`select * from public.report_incidents('month', '2026-10-01', '2026-11-30')`), /beheerder of teamleider/));
  });

  it('houdt maandtotalen bij, alleen via de geplande taak, en leest oude maanden daaruit', async () => {
    await as(anna, () => expectError(db.query('select public.refresh_monthly_totals()'), /permission denied/));
    await withSession(db, { role: 'service_role' }, () => db.query('select public.refresh_monthly_totals()'));
    const totals = await db.query(`select month::text, kind, total from public.monthly_incident_totals order by month, kind`);
    expect(totals.rows).toEqual([
      { month: '2026-10-01', kind: 'cancellation', total: 2 },
      { month: '2026-11-01', kind: 'cancellation', total: 1 },
      { month: '2026-11-01', kind: 'late_return', total: 1 },
    ]);
    // Een maand van drie jaar terug staat alleen nog in de totalen: die telt mee bij maand en jaar, niet bij week.
    await db.query(
      `insert into public.monthly_incident_totals (month, group_id, workshop_id, kind, total, chargeable, charged)
       values ('2023-03-01', 'den_bosch', $1, 'wrong_vehicle', 7, 0, 0)`,
      [vw],
    );
    const old = await as(tess, () => value<number>(`select sum(total)::int as v from public.report_incidents('year', '2023-01-01', '2023-12-31')`));
    expect(old).toBe(7);
    const weekly = await as(tess, () => value<number>(`select count(*)::int as v from public.report_incidents('week', '2023-01-01', '2023-12-31')`));
    expect(weekly).toBe(0);
    // De teamleider leest de totalen, een medewerker niet.
    expect(await as(tess, () => value<number>(`select count(*)::int as v from public.monthly_incident_totals`))).toBe(4);
    expect(await as(bas, () => value<number>(`select count(*)::int as v from public.monthly_incident_totals`))).toBe(0);
    // Opnieuw bijwerken laat oude maanden staan.
    await withSession(db, { role: 'service_role' }, () => db.query('select public.refresh_monthly_totals()'));
    expect(await value<number>(`select count(*)::int as v from public.monthly_incident_totals where month = '2023-03-01'`)).toBe(1);
  });

  it('bewaart de grenzen van de signalen, alleen door de beheerder, met het logboek erbij', async () => {
    await as(anna, () => db.query('update public.settings set signal_charge_days = 21, signal_unused_percent = null where id = true'));
    expect(await value(`select signal_charge_days as v from public.settings`)).toBe(21);
    await as(anna, () => expectError(db.query('update public.settings set signal_short_days = 9 where id = true'), /settings_signal_bounds/));
    const changed = await as(tess, () => db.query('update public.settings set signal_charge_days = 3 where id = true'));
    expect(changed.affectedRows).toBe(0);
    const log = await db.query<{ changed_fields: string[] }>(
      `select changed_fields from public.audit_log where entity = 'settings' order by id desc limit 1`,
    );
    expect(log.rows[0]?.changed_fields).toEqual(['signal_charge_days', 'signal_unused_percent']);
  });

  it('laat de teamleider een rapport exporteren, en een medewerker niet', async () => {
    await as(tess, () => db.query(`select public.log_export('reports', null)`));
    await as(bas, () => expectError(db.query(`select public.log_export('reports', null)`), /beheerder of teamleider/));
  });
});
