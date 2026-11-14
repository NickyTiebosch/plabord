import { readFileSync } from 'node:fs';
import type { PGlite } from '@electric-sql/pglite';
import { beforeAll, describe, expect, it } from 'vitest';
import { createDatabase, createPerson, expectError, session, setupSql, withSession, type TestPerson } from './helpers';

const TESTDATA = new URL('../setup/testdata.sql', import.meta.url);

describe('fase 5: de rol teamleider', () => {
  let db: PGlite;
  let anna: TestPerson; // beheerder
  let tess: TestPerson; // teamleider
  let bas: TestPerson; // medewerker
  let otto: TestPerson; // teamleider, maar inactief

  beforeAll(async () => {
    db = await createDatabase();
    anna = await createPerson(db, { name: 'Anna', isAdmin: true, role: 'none', groupId: 'other' });
    tess = await createPerson(db, { name: 'Tess', role: 'none', groupId: 'other' });
    bas = await createPerson(db, { name: 'Bas' });
    otto = await createPerson(db, { name: 'Otto', role: 'none', groupId: 'other' });
    await db.query('update public.employees set is_team_lead = true where id = any($1)', [[tess.employeeId, otto.employeeId]]);
    await db.query('update public.employees set is_active = false where id = $1', [otto.employeeId]);
  });

  it('laat een teamleider afwezigheid invoeren, wijzigen, goedkeuren en verwijderen', async () => {
    await withSession(db, session(tess), async () => {
      const inserted = await db.query<{ id: string }>(
        `insert into public.absences (employee_id, start_date, end_date, status)
         values ($1, '2026-11-16', '2026-11-17', 'requested') returning id`,
        [bas.employeeId],
      );
      const id = inserted.rows[0]?.id;
      const approved = await db.query(`update public.absences set status = 'approved' where id = $1`, [id]);
      expect(approved.affectedRows).toBe(1);
      const removed = await db.query('delete from public.absences where id = $1', [id]);
      expect(removed.affectedRows).toBe(1);
    });
  });

  it('laat een teamleider gaten regelen: inval, roosterwijziging voor één dag, negeren en de controle', async () => {
    await withSession(db, session(tess), async () => {
      await db.query(`insert into public.substitutions (employee_id, date, group_id, day_part) values ($1, '2026-11-18', 'eindhoven', 'morning')`, [
        bas.employeeId,
      ]);
      await db.query(`select public.set_shift_override($1, '2026-11-19', 'shift', 'breda', 'counter', null, null)`, [tess.employeeId]);
      await db.query(`insert into public.gap_dismissals (group_id, date, day_part, shortage) values ('breda', '2026-11-20', 'morning', 1)`);
      const dismissals = await db.query('select * from public.gap_dismissals');
      expect(dismissals.rows).toHaveLength(1);
      const sub = await db.query<{ id: string }>('select id from public.substitutions');
      const reviewed = await db.query<{ total: number }>('select public.apply_substitution_review($1) as total', [
        JSON.stringify([{ id: sub.rows[0]?.id, status: 'not_needed' }]),
      ]);
      expect(reviewed.rows[0]?.total).toBe(1);
      // De stand van de mails bij "Let op": lezen mag (geen adressen of tekst), klaarzetten niet.
      await db.query('select * from public.mail_queue');
      await expectError(
        db.query(`insert into public.mail_queue (employee_id, kind, dates) values ($1, 'day_changed', '{2026-11-19}')`, [bas.employeeId]),
        /row-level security/,
      );
    });
  });

  it('laat een teamleider geen medewerkers, accounts, vaste diensten, sluitingsdagen, normen of instellingen wijzigen', async () => {
    await withSession(db, session(tess), async () => {
      await expectError(db.query(`insert into public.employees (name, group_id) values ('Nieuw', 'breda')`), /row-level security/);
      const promote = await db.query('update public.employees set is_admin = true, is_team_lead = true where id = $1', [bas.employeeId]);
      expect(promote.affectedRows).toBe(0);
      const self = await db.query('update public.employees set is_admin = true where id = $1', [tess.employeeId]);
      expect(self.affectedRows).toBe(0);
      const emails = await db.query<{ email: string }>('select email from public.employee_accounts');
      expect(emails.rows).toEqual([{ email: 'tess@voorbeeld.nl' }]);
      await expectError(
        db.query(`insert into public.recurring_shifts (employee_id, weekday, group_id, role, valid_from) values ($1, 1, 'breda', 'counter', '2026-11-16')`, [
          bas.employeeId,
        ]),
        /row-level security/,
      );
      await expectError(
        db.query(`insert into public.closure_days (date, group_id, is_closed) values ('2026-12-24', null, true)`),
        /row-level security/,
      );
      expect((await db.query('update public.settings set lookahead_weeks = 4')).affectedRows).toBe(0);
      expect((await db.query('update public.staffing_norms set min_staff = 9')).affectedRows).toBe(0);
      expect((await db.query('update public.groups set mobility_loans_per_day = 9')).affectedRows).toBe(0);
      expect((await db.query('select * from public.audit_log')).rows).toEqual([]);
      await expectError(db.query('select public.employee_sign_ins()'), /Alleen een beheerder/);
      await expectError(db.query(`select public.log_export('planning', null)`), /Alleen een beheerder/);
      await expectError(db.query('select public.apply_import($1)', ['{}']), /Alleen een beheerder/);
    });
  });

  it('geeft een gewone medewerker en een inactieve teamleider geen extra rechten', async () => {
    for (const person of [bas, otto]) {
      await withSession(db, session(person), async () => {
        await expectError(
          db.query(`insert into public.absences (employee_id, start_date, end_date) values ($1, '2026-11-23', '2026-11-23')`, [bas.employeeId]),
          /row-level security/,
        );
        await expectError(
          db.query(`insert into public.substitutions (employee_id, date, group_id) values ($1, '2026-11-24', 'breda')`, [bas.employeeId]),
          // Wie inactief is, ziet de vestigingen niet; dan weigert de controle op de vestiging al eerder.
          /row-level security|alleen in een vestiging met een balie/,
        );
        await expectError(
          db.query(`insert into public.gap_dismissals (group_id, date, day_part, shortage) values ('breda', '2026-11-25', 'morning', 1)`),
          /row-level security/,
        );
        expect((await db.query('select * from public.gap_dismissals')).rows).toEqual([]);
        expect((await db.query('select * from public.mail_queue')).rows).toEqual([]);
        await expectError(db.query('select public.apply_substitution_review($1)', ['[]']), /Alleen een beheerder of teamleider/);
      });
    }
  });

  it('laat alleen een beheerder iemand teamleider maken, en zet dat in het logboek', async () => {
    await withSession(db, session(anna), async () => {
      const made = await db.query('update public.employees set is_team_lead = true where id = $1', [bas.employeeId]);
      expect(made.affectedRows).toBe(1);
      const log = await db.query<{ details: Record<string, unknown> }>(
        `select details from public.audit_log where entity = 'employees' and employee_id = $1 order by id desc limit 1`,
        [bas.employeeId],
      );
      expect(log.rows[0]?.details).toEqual({ is_team_lead: { old: false, new: true } });
      await db.query('update public.employees set is_team_lead = false where id = $1', [bas.employeeId]);
    });
  });
});

describe('fase 5: de uitleen', () => {
  let db: PGlite;
  let anna: TestPerson; // beheerder
  let tess: TestPerson; // teamleider
  let bas: TestPerson; // medewerker Den Bosch
  let ruben: TestPerson; // medewerker Den Bosch
  let eva: TestPerson; // medewerker Eindhoven

  beforeAll(async () => {
    db = await createDatabase();
    anna = await createPerson(db, { name: 'Anna', isAdmin: true, role: 'none', groupId: 'other' });
    tess = await createPerson(db, { name: 'Tess', role: 'none', groupId: 'other' });
    bas = await createPerson(db, { name: 'Bas' });
    ruben = await createPerson(db, { name: 'Ruben' });
    eva = await createPerson(db, { name: 'Eva', groupId: 'eindhoven' });
    await db.query('update public.employees set is_team_lead = true where id = $1', [tess.employeeId]);
  });

  function handOut(person: TestPerson, plate: string, extra: Record<string, unknown> = {}) {
    const values = { group_id: 'den_bosch', model: 'VW Polo', destination: 'mobility', handed_to: 'Mobiliteit', ...extra };
    const columns = ['license_plate', ...Object.keys(values)];
    const params = [plate, ...Object.values(values)];
    return withSession(db, session(person), () =>
      db.query<{ id: string; handed_out_by: string }>(
        `insert into public.vehicle_loans (${columns.join(', ')}) values (${columns.map((_, index) => `$${index + 1}`).join(', ')})
         returning id, handed_out_by`,
        params,
      ),
    );
  }

  async function loan(id: string) {
    const result = await db.query<{
      returned_at: string | null;
      returned_by: string | null;
      was_used: boolean | null;
      odometer_in: number | null;
      return_note: string | null;
    }>('select returned_at, returned_by, was_used, odometer_in, return_note from public.vehicle_loans where id = $1', [id]);
    return result.rows[0];
  }

  it('zet bij de setup 2 auto’s voor Mobiliteit bij de vestigingen, en laat een gewijzigde waarde staan', async () => {
    const before = await db.query('select id, mobility_loans_per_day from public.groups order by sort_order');
    expect(before.rows).toEqual([
      { id: 'den_bosch', mobility_loans_per_day: 2 },
      { id: 'eindhoven', mobility_loans_per_day: 2 },
      { id: 'breda', mobility_loans_per_day: 2 },
      { id: 'logistics', mobility_loans_per_day: 0 },
      { id: 'backoffice', mobility_loans_per_day: 0 },
      { id: 'other', mobility_loans_per_day: 0 },
    ]);
    await withSession(db, session(anna), () => db.query(`update public.groups set mobility_loans_per_day = 3 where id = 'breda'`));
    await db.exec(setupSql());
    const after = await db.query<{ mobility_loans_per_day: number }>(`select mobility_loans_per_day from public.groups where id = 'breda'`);
    expect(after.rows[0]?.mobility_loans_per_day).toBe(3);
  });

  it('laat iedere medewerker van een vestiging die uitleent een auto aanmelden, altijd op eigen naam', async () => {
    const own = await handOut(bas, 'GHP39K');
    expect(own.rows[0]?.handed_out_by).toBe(bas.employeeId);
    const other = await handOut(ruben, 'X920RV', { handed_out_by: anna.employeeId }).catch((error: Error) => error);
    // handed_out_by mag niet worden meegestuurd; zonder dat veld vult de database het in.
    expect(other).toBeInstanceOf(Error);
    const seen = await withSession(db, session(ruben), () => db.query('select * from public.vehicle_loans'));
    expect(seen.rows).toHaveLength(1);
  });

  it('weigert een auto die al uit staat, een ongeldig kenteken en een groep zonder balie', async () => {
    await expectError(handOut(ruben, 'GHP39K'), /vehicle_loans_one_open_per_plate|duplicate key/);
    await expectError(handOut(bas, 'ghp-39-k'), /vehicle_loans_plate_format/);
    await expectError(handOut(bas, 'AB12CD', { group_id: 'logistics' }), /vehicle_loans_group_fkey|foreign key/);
    await expectError(handOut(bas, 'AB12CD', { destination: 'garage' }), /vehicle_loans_destination/);
    await expectError(handOut(bas, 'AB12CD', { handed_to: '  ' }), /vehicle_loans_handed_to_format/);
    await expectError(
      withSession(db, session(bas), () =>
        db.query(
          `insert into public.vehicle_loans (group_id, license_plate, model, destination, handed_to, returned_at)
           values ('den_bosch', 'AB12CD', 'Golf', 'mobility', 'Mobiliteit', now())`,
        ),
      ),
      /permission denied/,
    );
  });

  it('geeft anon op niets toegang', async () => {
    await withSession(db, { role: 'anon' }, async () => {
      await expectError(db.query('select * from public.vehicle_loans'), /permission denied/);
      await expectError(db.query(`select public.return_vehicle_loan(gen_random_uuid(), true)`), /permission denied/);
    });
  });

  it('laat een collega een auto retour melden, ingezet of niet, en maar één keer', async () => {
    const id = (await handOut(bas, 'KPK66J', { odometer_out: 1000 })).rows[0]?.id ?? '';
    await withSession(db, session(ruben), async () => {
      await expectError(db.query('select public.return_vehicle_loan($1, true, 900)', [id]), /vehicle_loans_odometer_order/);
      await expectError(db.query('select public.return_vehicle_loan($1, null)', [id]), /Kies of de auto is ingezet/);
      await expectError(
        db.query(`select public.return_vehicle_loan($1, true, null, null, now() + interval '1 hour')`, [id]),
        /in de toekomst/,
      );
      const done = await db.query<{ n: number }>(`select public.return_vehicle_loan($1, true, 1042, ' Pech onderweg ') as n`, [id]);
      expect(done.rows[0]?.n).toBe(1);
      const again = await db.query<{ n: number }>('select public.return_vehicle_loan($1, false) as n', [id]);
      expect(again.rows[0]?.n).toBe(0);
    });
    expect(await loan(id)).toMatchObject({ returned_by: ruben.employeeId, was_used: true, odometer_in: 1042, return_note: 'Pech onderweg' });
  });

  it('laat wie retour meldde dat vandaag ongedaan maken; anderen niet, de teamleider wel', async () => {
    const id = (await handOut(bas, 'T826HN')).rows[0]?.id ?? '';
    await withSession(db, session(bas), () => db.query('select public.return_vehicle_loan($1, false)', [id]));
    await withSession(db, session(ruben), () =>
      expectError(db.query('select public.undo_vehicle_loan_return($1)', [id]), /Alleen wie de auto retour meldde/),
    );
    const undone = await withSession(db, session(bas), () =>
      db.query<{ n: number }>('select public.undo_vehicle_loan_return($1) as n', [id]),
    );
    expect(undone.rows[0]?.n).toBe(1);
    expect(await loan(id)).toMatchObject({ returned_at: null, returned_by: null, was_used: null });

    // Gisteren retour gemeld: alleen de teamleider kan het nog terugdraaien.
    await withSession(db, session(bas), () => db.query('select public.return_vehicle_loan($1, true)', [id]));
    await db.query(`update public.vehicle_loans set returned_at = now() - interval '2 days', handed_out_at = now() - interval '3 days' where id = $1`, [id]);
    await withSession(db, session(bas), () =>
      expectError(db.query('select public.undo_vehicle_loan_return($1)', [id]), /Alleen wie de auto retour meldde/),
    );
    const byLead = await withSession(db, session(tess), () =>
      db.query<{ n: number }>('select public.undo_vehicle_loan_return($1) as n', [id]),
    );
    expect(byLead.rows[0]?.n).toBe(1);
  });

  it('kan een retour niet ongedaan maken als dezelfde auto alweer uit staat', async () => {
    const first = (await handOut(bas, 'KJL05P')).rows[0]?.id ?? '';
    await withSession(db, session(bas), () => db.query('select public.return_vehicle_loan($1, true)', [first]));
    await handOut(ruben, 'KJL05P');
    await withSession(db, session(bas), () =>
      expectError(db.query('select public.undo_vehicle_loan_return($1)', [first]), /vehicle_loans_one_open_per_plate|duplicate key/),
    );
  });

  it('laat een collega een registratie van een ander niet corrigeren of verwijderen; de teamleider wel', async () => {
    // Sinds fase 6 (V59) kan wie aanmeldde het op dezelfde dag zelf; zie phase6.test.ts.
    const id = (await handOut(ruben, 'V02KZD')).rows[0]?.id ?? '';
    await withSession(db, session(bas), async () => {
      expect((await db.query(`update public.vehicle_loans set model = 'Golf' where id = $1`, [id])).affectedRows).toBe(0);
      expect((await db.query('delete from public.vehicle_loans where id = $1', [id])).affectedRows).toBe(0);
      await expectError(db.query('update public.vehicle_loans set handed_out_by = $1 where id = $2', [ruben.employeeId, id]), /permission denied/);
    });
    await withSession(db, session(tess), async () => {
      expect((await db.query(`update public.vehicle_loans set model = 'VW Golf' where id = $1`, [id])).affectedRows).toBe(1);
      expect((await db.query('delete from public.vehicle_loans where id = $1', [id])).affectedRows).toBe(1);
    });
  });

  it('zet aanmelden en retour in het logboek, zonder aan wie en zonder opmerkingen', async () => {
    const id = (await handOut(bas, 'V26JXD', { handed_to: 'Jansen Mobiliteit', note: 'Geheime opmerking' })).rows[0]?.id ?? '';
    await withSession(db, session(bas), () => db.query(`select public.return_vehicle_loan($1, false, null, 'Ook geheim')`, [id]));
    const log = await db.query<{ action: string; details: Record<string, unknown>; actor_employee_id: string }>(
      `select action, details, actor_employee_id from public.audit_log where entity = 'vehicle_loans' and entity_id = $1 order by id`,
      [id],
    );
    expect(log.rows.map((row) => row.action)).toEqual(['insert', 'update']);
    expect(log.rows[0]?.details).toMatchObject({ license_plate: 'V26JXD', group_id: 'den_bosch', destination: 'mobility' });
    expect(log.rows.every((row) => row.actor_employee_id === bas.employeeId)).toBe(true);
    const text = JSON.stringify(log.rows);
    expect(text).not.toContain('Jansen');
    expect(text).not.toContain('Geheim');
  });

  it('ruimt registraties op die langer dan 24 maanden retour zijn', async () => {
    await db.query(
      `insert into public.vehicle_loans (group_id, license_plate, model, destination, handed_to, handed_out_at, returned_at, was_used)
       values ('den_bosch', 'OUD001', 'Polo', 'mobility', 'Mobiliteit', now() - interval '3 years', now() - interval '25 months', true),
              ('den_bosch', 'OUD002', 'Polo', 'mobility', 'Mobiliteit', now() - interval '2 years', now() - interval '23 months', true)`,
    );
    await handOut(bas, 'NIEUW1');
    const left = await db.query<{ license_plate: string }>(`select license_plate from public.vehicle_loans where license_plate like 'OUD%'`);
    expect(left.rows.map((row) => row.license_plate)).toEqual(['OUD002']);
    const log = await db.query<{ source: string }>(`select source from public.audit_log where entity = 'vehicle_loans' and action = 'delete' and details ->> 'license_plate' = 'OUD001'`);
    expect(log.rows).toEqual([{ source: 'opruimen' }]);
  });

  it('laat iedere vestiging Mobiliteit zien en auto’s meegeven (V54, vervangt V52)', async () => {
    // Eva werkt in Eindhoven: ze ziet alles, en kan voor Eindhoven een auto meegeven.
    const id = (await handOut(eva, 'V54AAA', { group_id: 'eindhoven', destination: 'workshop_weekend', handed_to: 'Werkplaats Eindhoven' })).rows[0]?.id ?? '';
    const seen = await withSession(db, session(eva), () =>
      db.query<{ license_plate: string }>('select license_plate from public.vehicle_loans order by license_plate'),
    );
    expect(seen.rows.map((row) => row.license_plate)).toContain('V54AAA');
    const bySanne = await withSession(db, session(bas), () =>
      db.query<{ n: number }>(`select count(*)::int as n from public.vehicle_loans where license_plate = 'V54AAA'`),
    );
    expect(bySanne.rows[0]?.n).toBe(1);
    await withSession(db, session(bas), () => db.query('select public.return_vehicle_loan($1, true)', [id]));
    expect((await loan(id))?.was_used).toBe(true);

    // De beperking van V52 is weg: geen kolom, geen functies, geen extra controle.
    const leftovers = await db.query<{ n: number }>(
      `select (select count(*)::int from information_schema.columns where table_name = 'groups' and column_name = 'lends_vehicles')
            + (select count(*)::int from pg_proc where proname in ('uses_loans', 'check_vehicle_loan')) as n`,
    );
    expect(leftovers.rows[0]?.n).toBe(0);
    // Een groep zonder balie kan nog steeds geen auto's krijgen.
    await expectError(handOut(bas, 'V54BBB', { group_id: 'other' }), /vehicle_loans_group_fkey|foreign key/);
  });

  it('laat de beheerder en de teamleider de uitleen exporteren, en een medewerker niet', async () => {
    await withSession(db, session(tess), () => db.query(`select public.log_export('loans', null)`));
    await withSession(db, session(anna), () => db.query(`select public.log_export('loans', null)`));
    await withSession(db, session(bas), () => expectError(db.query(`select public.log_export('loans', null)`), /beheerder of teamleider/));
    const exports = await db.query(`select details from public.audit_log where entity = 'export'`);
    expect(exports.rows).toEqual([{ details: { kind: 'loans' } }, { details: { kind: 'loans' } }]);
  });

  it('houdt registraties zonder naam als de medewerker volledig wordt verwijderd', async () => {
    const id = (await handOut(ruben, 'WEG001')).rows[0]?.id ?? '';
    await db.query('update public.employees set is_active = false where id = $1', [ruben.employeeId]);
    await withSession(db, session(anna), () => db.query('select public.delete_employee($1)', [ruben.employeeId]));
    const kept = await db.query<{ handed_out_by: string | null }>('select handed_out_by from public.vehicle_loans where id = $1', [id]);
    expect(kept.rows).toEqual([{ handed_out_by: null }]);
  });
});

describe('fase 5: testgegevens voor het testproject', () => {
  it('kan twee keer achter elkaar draaien, na de setup', async () => {
    const db = await createDatabase();
    const sql = readFileSync(TESTDATA, 'utf8');
    await db.exec(sql);
    await db.exec(sql);
    const counts = await db.query<{ employees: number; accounts: number; loans: number; open: number }>(
      `select (select count(*)::int from public.employees) as employees,
              (select count(*)::int from public.employee_accounts) as accounts,
              (select count(*)::int from public.vehicle_loans) as loans,
              (select count(*)::int from public.vehicle_loans where returned_at is null) as open`,
    );
    expect(counts.rows[0]?.accounts).toBe(0);
    expect(counts.rows[0]?.employees).toBeGreaterThanOrEqual(20);
    expect(counts.rows[0]?.loans).toBeGreaterThan(0);
    expect(counts.rows[0]?.open).toBeGreaterThan(0);
    // Fase 6: binnenvallers, afgesloten dagen en meldingen.
    const phase6 = await db.query<{ walk_ins: number; closures: number; incidents: number }>(
      `select (select count(*)::int from public.walk_ins) as walk_ins,
              (select count(*)::int from public.day_closures) as closures,
              (select count(*)::int from public.incident_reports where id::text like '33000000-%') as incidents`,
    );
    expect(phase6.rows[0]?.walk_ins).toBeGreaterThan(0);
    expect(phase6.rows[0]?.closures).toBeGreaterThan(0);
    expect(phase6.rows[0]?.incidents).toBe(5);
    // Fase 8: auto's op het terrein.
    const parked = await db.query<{ n: number }>(`select count(*)::int as n from public.vehicle_locations`);
    expect(parked.rows[0]?.n).toBe(4);
  });
});
