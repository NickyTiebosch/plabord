import type { PGlite } from '@electric-sql/pglite';
import { beforeAll, describe, expect, it } from 'vitest';
import { createDatabase, createPerson, expectError, session, setupSql, withSession, type TestPerson } from './helpers';

describe('fase 6: binnenvallers, meldingen en dag afsluiten', () => {
  let db: PGlite;
  let anna: TestPerson; // beheerder
  let tess: TestPerson; // teamleider
  let bas: TestPerson; // medewerker Den Bosch
  let eva: TestPerson; // medewerker Eindhoven
  let vw: string; // werkplaats Volkswagen, Den Bosch
  let audi: string;

  const as = <T>(person: TestPerson, run: () => Promise<T>) => withSession(db, session(person), run);
  const value = async <T>(sql: string, params: unknown[] = []) => (await db.query<{ v: T }>(sql, params)).rows[0]?.v;

  beforeAll(async () => {
    db = await createDatabase();
    anna = await createPerson(db, { name: 'Anna', isAdmin: true, role: 'none', groupId: 'other' });
    tess = await createPerson(db, { name: 'Tess', role: 'none', groupId: 'other' });
    bas = await createPerson(db, { name: 'Bas' });
    eva = await createPerson(db, { name: 'Eva', groupId: 'eindhoven' });
    await db.query('update public.employees set is_team_lead = true where id = $1', [tess.employeeId]);
    vw = (await value<string>(`select id as v from public.workshops where group_id = 'den_bosch' and name = 'Volkswagen'`)) ?? '';
    audi = (await value<string>(`select id as v from public.workshops where group_id = 'den_bosch' and name = 'Audi'`)) ?? '';
  });

  it('zet de werkplaatsen uit de Excel-bestanden klaar, en zet ze bij opnieuw draaien niet terug (V56)', async () => {
    const counts = await db.query(`select group_id, count(*)::int as n from public.workshops group by group_id order by group_id`);
    expect(counts.rows).toEqual([
      { group_id: 'breda', n: 8 },
      { group_id: 'den_bosch', n: 7 },
      { group_id: 'eindhoven', n: 5 },
    ]);
    await as(anna, () => db.query(`update public.workshops set name = 'VW' where id = $1`, [vw]));
    await db.exec(setupSql());
    expect(await value(`select name as v from public.workshops where id = $1`, [vw])).toBe('VW');
    expect(await value(`select count(*)::int as v from public.workshops`)).toBe(20);
    await as(anna, () => db.query(`update public.workshops set name = 'Volkswagen' where id = $1`, [vw]));
  });

  it('laat alleen de beheerder werkplaatsen beheren', async () => {
    await as(tess, () =>
      expectError(db.query(`insert into public.workshops (group_id, name) values ('den_bosch', 'Nieuw')`), /row-level security/),
    );
    const changed = await as(bas, () => db.query(`update public.workshops set is_active = false where id = $1`, [vw]));
    expect(changed.affectedRows).toBe(0);
    await as(anna, () =>
      expectError(db.query(`insert into public.workshops (group_id, name) values ('den_bosch', 'Audi')`), /workshops_name_key/),
    );
    await as(anna, () =>
      expectError(db.query(`insert into public.workshops (group_id, name) values ('logistics', 'Audi')`), /workshops_group_fkey|foreign key/),
    );
  });

  it('telt binnenvallers met plus en min, nooit onder 0, en onthoudt wie het laatst wijzigde (V57)', async () => {
    const adjust = (person: TestPerson, delta: number, date = 'current_date') =>
      as(person, () => value<number>(`select public.adjust_walk_in($1, ${date}, $2) as v`, [vw, delta]));
    expect(await adjust(bas, 1)).toBe(1);
    expect(await adjust(eva, 2)).toBe(3);
    expect(await adjust(bas, -5)).toBe(0);
    expect(await adjust(bas, 4)).toBe(4);
    const row = await db.query(`select group_id, count, updated_by from public.walk_ins where workshop_id = $1`, [vw]);
    expect(row.rows).toEqual([{ group_id: 'den_bosch', count: 4, updated_by: bas.employeeId }]);
    // Rechtstreeks schrijven kan niet: alleen via de functie.
    await as(bas, () => expectError(db.query(`update public.walk_ins set count = 99`), /permission denied/));
    await as(bas, () => expectError(db.query(`select public.adjust_walk_in($1, current_date + 1, 1)`, [vw]), /toekomst/));
    await as(bas, () => expectError(db.query(`select public.adjust_walk_in($1, current_date, 0)`, [vw]), /aantal/));
  });

  it('laat ouder dan een week alleen de teamleider of beheerder aanpassen', async () => {
    await as(bas, () => db.query(`select public.adjust_walk_in($1, current_date - 7, 1)`, [audi]));
    await as(bas, () => expectError(db.query(`select public.adjust_walk_in($1, current_date - 8, 1)`, [audi]), /teamleider/));
    expect(await as(tess, () => value<number>(`select public.adjust_walk_in($1, current_date - 8, 2) as v`, [audi]))).toBe(2);
  });

  function report(person: TestPerson, extra: Record<string, unknown> = {}) {
    const values = { group_id: 'den_bosch', workshop_id: vw, kind: 'wrong_vehicle', license_plate: 'GHP39K', ...extra };
    const columns = Object.keys(values);
    return as(person, () =>
      db.query<{ id: string; reported_by: string }>(
        `insert into public.incident_reports (${columns.join(', ')}) values (${columns.map((_, i) => `$${i + 1}`).join(', ')})
         returning id, reported_by`,
        Object.values(values),
      ),
    );
  }

  it('laat iedere medewerker een melding maken, altijd op eigen naam (V58)', async () => {
    const made = await report(bas);
    expect(made.rows[0]?.reported_by).toBe(bas.employeeId);
    await expectError(report(bas, { reported_by: anna.employeeId }), /permission denied/);
    await report(eva, { kind: 'cancellation', cancelled_at: '11:20', charge: true, contract_number: '681613' });
    const seen = await as(eva, () => db.query('select id from public.incident_reports'));
    expect(seen.rows).toHaveLength(2);
  });

  it('bewaakt de vorm van een melding', async () => {
    await expectError(report(bas, { kind: 'garage' }), /incident_reports_kind/);
    await expectError(report(bas, { kind: 'wrong_vehicle', missing: 'signature' }), /incident_reports_missing/);
    await expectError(report(bas, { kind: 'contract_license', missing: 'paspoort' }), /incident_reports_missing/);
    await expectError(report(bas, { kind: 'cancellation' }), /incident_reports_cancellation_shape/);
    await expectError(report(bas, { kind: 'late_return', charge: true }), /incident_reports_cancellation_shape/);
    await expectError(report(bas, { license_plate: 'ghp-39-k' }), /incident_reports_plate_format/);
    // Een werkplaats van een andere vestiging hoort er niet bij.
    await expectError(report(bas, { group_id: 'eindhoven' }), /incident_reports_workshop_fkey|foreign key/);
    await report(bas, { kind: 'contract_license', missing: 'both' });
  });

  it('laat de melder op dezelfde dag zelf corrigeren en verwijderen; daarna de teamleider (V59)', async () => {
    const id = (await report(bas, { note: 'Verkeerde sleutel' })).rows[0]?.id ?? '';
    const own = await as(bas, () => db.query(`update public.incident_reports set license_plate = 'X920RV' where id = $1`, [id]));
    expect(own.affectedRows).toBe(1);
    const other = await as(eva, () => db.query(`update public.incident_reports set license_plate = 'AAA111' where id = $1`, [id]));
    expect(other.affectedRows).toBe(0);
    // Gisteren gemaakt: de melder kan het niet meer, de teamleider wel.
    await db.query(`update public.incident_reports set created_at = now() - interval '1 day' where id = $1`, [id]);
    const late = await as(bas, () => db.query(`delete from public.incident_reports where id = $1`, [id]));
    expect(late.affectedRows).toBe(0);
    const byLead = await as(tess, () => db.query(`delete from public.incident_reports where id = $1`, [id]));
    expect(byLead.affectedRows).toBe(1);
  });

  it('past dezelfde regel toe bij Mobiliteit: zelf corrigeren op dezelfde dag (V59)', async () => {
    const loan = await as(bas, () =>
      db.query<{ id: string }>(
        `insert into public.vehicle_loans (group_id, license_plate, model, destination, handed_to)
         values ('den_bosch', 'FOUT01', 'VW Polo', 'mobility', 'Mobiliteit') returning id`,
      ),
    );
    const id = loan.rows[0]?.id ?? '';
    expect((await as(bas, () => db.query(`update public.vehicle_loans set license_plate = 'GOED01' where id = $1`, [id]))).affectedRows).toBe(1);
    expect((await as(eva, () => db.query(`update public.vehicle_loans set model = 'Golf' where id = $1`, [id]))).affectedRows).toBe(0);
    await db.query(`update public.vehicle_loans set created_at = now() - interval '1 day', handed_out_at = now() - interval '1 day' where id = $1`, [id]);
    expect((await as(bas, () => db.query(`update public.vehicle_loans set model = 'Golf' where id = $1`, [id]))).affectedRows).toBe(0);
    expect((await as(tess, () => db.query(`delete from public.vehicle_loans where id = $1`, [id]))).affectedRows).toBe(1);
  });

  it('laat alleen de teamleider en beheerder doorbelast omzetten, en alleen bij een annulering die doorbelast wordt (V62)', async () => {
    const charge = (await report(bas, { kind: 'cancellation', cancelled_at: '12:00', charge: true })).rows[0]?.id ?? '';
    const free = (await report(bas, { kind: 'cancellation', cancelled_at: '09:00', charge: false })).rows[0]?.id ?? '';
    await as(bas, () => expectError(db.query('select public.set_incident_charged($1, true)', [charge]), /beheerder of teamleider/));
    expect(await as(tess, () => value<number>('select public.set_incident_charged($1, true) as v', [charge]))).toBe(1);
    expect(await as(tess, () => value<number>('select public.set_incident_charged($1, true) as v', [charge]))).toBe(0);
    expect(await as(tess, () => value<number>('select public.set_incident_charged($1, true) as v', [free]))).toBe(0);
    const row = await db.query(`select charged_by, charged_at is not null as done from public.incident_reports where id = $1`, [charge]);
    expect(row.rows).toEqual([{ charged_by: tess.employeeId, done: true }]);
    expect(await as(anna, () => value<number>('select public.set_incident_charged($1, false) as v', [charge]))).toBe(1);
    // Een medewerker kan doorbelast ook niet rechtstreeks zetten.
    await as(bas, () => expectError(db.query(`update public.incident_reports set charged_at = now() where id = $1`, [charge]), /permission denied/));
  });

  it('sluit een dag af, één keer, en laat alleen de teamleider heropenen (V60)', async () => {
    const close = (person: TestPerson, checked: boolean, date = 'current_date') =>
      as(person, () => value<boolean>(`select public.close_day('den_bosch', ${date}, $1) as v`, [checked]));
    expect(await close(bas, false)).toBe(true);
    expect(await close(eva, true)).toBe(false);
    const row = await db.query(`select rentlink_checked, closed_by from public.day_closures where group_id = 'den_bosch'`);
    // Het vinkje komt erbij; wie afsloot blijft staan.
    expect(row.rows).toEqual([{ rentlink_checked: true, closed_by: bas.employeeId }]);
    expect(await close(bas, true, 'current_date - 3')).toBe(true);
    await as(bas, () => expectError(db.query(`select public.close_day('den_bosch', current_date + 1, true)`), /toekomst/));
    await as(bas, () => expectError(db.query(`select public.close_day('logistics', current_date, true)`), /balie/));
    await as(bas, () => expectError(db.query(`select public.reopen_day('den_bosch', current_date)`), /beheerder of teamleider/));
    await as(bas, () => expectError(db.query(`delete from public.day_closures`), /permission denied/));
    expect(await as(tess, () => value<number>(`select public.reopen_day('den_bosch', current_date) as v`))).toBe(1);
  });

  it('geeft anon op niets toegang', async () => {
    await withSession(db, { role: 'anon' }, async () => {
      for (const table of ['workshops', 'walk_ins', 'incident_reports', 'day_closures']) {
        await expectError(db.query(`select * from public.${table}`), /permission denied/);
      }
      await expectError(db.query(`select public.adjust_walk_in($1, current_date, 1)`, [vw]), /permission denied/);
    });
  });

  it('zet alles in het logboek, zonder bijzonderheden', async () => {
    await report(bas, { note: 'Geheime toelichting' });
    const log = await db.query<{ details: Record<string, unknown> }>(
      `select details from public.audit_log where entity in ('incident_reports', 'walk_ins', 'day_closures', 'workshops')`,
    );
    expect(log.rows.length).toBeGreaterThan(5);
    expect(JSON.stringify(log.rows)).not.toContain('Geheime toelichting');
    expect(JSON.stringify(log.rows)).not.toContain('Verkeerde sleutel');
  });

  it('ruimt meldingen op die ouder zijn dan 24 maanden (V65)', async () => {
    await db.query(
      `insert into public.incident_reports (group_id, workshop_id, kind, occurred_at, import_key)
       values ('den_bosch', $1, 'late_return', now() - interval '25 months', 'oud-1'),
              ('den_bosch', $1, 'late_return', now() - interval '23 months', 'oud-2')`,
      [vw],
    );
    await report(bas);
    const left = await db.query<{ import_key: string }>(`select import_key from public.incident_reports where import_key like 'oud-%'`);
    expect(left.rows.map((row) => row.import_key)).toEqual(['oud-2']);
  });

  it('leest de historie in zonder dubbele regels, alleen door de beheerder (V63)', async () => {
    const plan = {
      walk_ins: [
        { workshop_id: vw, date: '2026-07-09', count: 3 },
        { workshop_id: audi, date: '2026-07-09', count: 0 },
      ],
      incidents: [
        {
          workshop_id: audi,
          occurred_at: '2026-09-17T12:00:00+02:00',
          kind: 'cancellation',
          cancelled_at: '17:00',
          charge: true,
          license_plate: 'JTX38S',
          contract_number: '681613',
          reported_by: bas.employeeId,
          import_key: 'den_bosch|4',
        },
        { workshop_id: vw, occurred_at: '2026-09-22T12:00:00+02:00', kind: 'late_return', reported_by: null, import_key: 'den_bosch|5' },
      ],
    };
    await as(tess, () => expectError(db.query('select public.import_registrations($1)', [JSON.stringify(plan)]), /beheerder/));
    const first = await as(anna, () => value<{ walk_ins: number; incidents: number }>('select public.import_registrations($1) as v', [JSON.stringify(plan)]));
    expect(first).toEqual({ walk_ins: 2, incidents: 2 });
    const second = await as(anna, () => value<{ walk_ins: number; incidents: number }>('select public.import_registrations($1) as v', [JSON.stringify(plan)]));
    expect(second).toEqual({ walk_ins: 0, incidents: 0 });
    // Wie het oude bestand noemde blijft staan, niet de beheerder die inleest.
    const who = await db.query(`select reported_by from public.incident_reports where import_key = 'den_bosch|4'`);
    expect(who.rows).toEqual([{ reported_by: bas.employeeId }]);
    // Zonder mark_charged: nog niet doorbelast.
    const open = await db.query(`select charged_by from public.incident_reports where import_key = 'den_bosch|4'`);
    expect(open.rows).toEqual([{ charged_by: null }]);
  });

  it('zet ingelezen annuleringen op doorbelast met mark_charged, alleen als ze doorbelast moesten worden', async () => {
    const plan = {
      mark_charged: true,
      incidents: [
        { workshop_id: vw, occurred_at: '2026-09-23T12:30:00+02:00', kind: 'cancellation', cancelled_at: '12:30', charge: true, import_key: 'hist|1' },
        { workshop_id: vw, occurred_at: '2026-09-23T09:30:00+02:00', kind: 'cancellation', cancelled_at: '09:30', charge: false, import_key: 'hist|2' },
      ],
    };
    await as(anna, () => db.query('select public.import_registrations($1)', [JSON.stringify(plan)]));
    const rows = await db.query<{ import_key: string; charged_by: string | null; charged: boolean }>(
      `select import_key, charged_by, charged_at is not null as charged from public.incident_reports where import_key like 'hist|%' order by import_key`,
    );
    expect(rows.rows).toEqual([
      { import_key: 'hist|1', charged_by: anna.employeeId, charged: true },
      { import_key: 'hist|2', charged_by: null, charged: false },
    ]);
  });

  it('laat de teamleider binnenvallers en meldingen exporteren, en een medewerker niet (V64)', async () => {
    await as(tess, () => db.query(`select public.log_export('walk_ins', null)`));
    await as(tess, () => db.query(`select public.log_export('incidents', null)`));
    await as(bas, () => expectError(db.query(`select public.log_export('incidents', null)`), /beheerder of teamleider/));
  });

  it('kan een werkplaats met cijfers niet verwijderen, wel op inactief zetten', async () => {
    await as(anna, () => expectError(db.query('delete from public.workshops where id = $1', [vw]), /foreign key|walk_ins_workshop_fkey|incident_reports_workshop_fkey/));
    const off = await as(anna, () => db.query('update public.workshops set is_active = false where id = $1', [vw]));
    expect(off.affectedRows).toBe(1);
  });
});
