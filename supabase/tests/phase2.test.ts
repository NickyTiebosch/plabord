import type { PGlite } from '@electric-sql/pglite';
import { beforeAll, describe, expect, it } from 'vitest';
import { createDatabase, createPerson, expectError, session, withSession, type TestPerson } from './helpers';

describe('fase 2: invallen, roosterwijzigingen en genegeerde gaten', () => {
  let db: PGlite;
  let admin: TestPerson;
  let bas: TestPerson; // medewerker
  let danique: TestPerson; // backoffice, de invaller in de tests

  beforeAll(async () => {
    db = await createDatabase();
    admin = await createPerson(db, { name: 'Anna', isAdmin: true, role: 'none', groupId: 'other' });
    bas = await createPerson(db, { name: 'Bas' });
    danique = await createPerson(db, { name: 'Danique', groupId: 'backoffice', role: 'backoffice' });
  });

  async function insertSubstitution(date: string, groupId = 'eindhoven', dayPart = 'full_day') {
    const result = await db.query<{ id: string }>(
      `insert into public.substitutions (employee_id, date, group_id, day_part) values ($1, $2, $3, $4) returning id`,
      [danique.employeeId, date, groupId, dayPart],
    );
    return result.rows[0]?.id ?? '';
  }

  describe('invallen', () => {
    it('laat een beheerder een inval toewijzen en iedereen hem zien', async () => {
      const id = await withSession(db, session(admin), () => insertSubstitution('2026-10-14'));
      expect(id).toMatch(/^[0-9a-f-]{36}$/);
      await withSession(db, session(bas), async () => {
        const rows = await db.query<{ status: string }>('select status from public.substitutions where id = $1', [id]);
        expect(rows.rows).toEqual([{ status: 'active' }]);
      });
    });

    it('laat een medewerker geen inval toewijzen of wijzigen', async () => {
      await withSession(db, session(bas), async () => {
        await expectError(insertSubstitution('2026-10-15'), /row-level security/);
        const updated = await db.query(`update public.substitutions set status = 'not_needed' returning id`);
        expect(updated.rows).toEqual([]);
      });
    });

    it('verwijdert nooit: ook een beheerder heeft geen delete', async () => {
      await withSession(db, session(admin), async () => {
        await expectError(db.query('delete from public.substitutions'), /permission denied/);
      });
    });

    it('geeft anon geen toegang', async () => {
      await withSession(db, { role: 'anon' }, async () => {
        await expectError(db.query('select * from public.substitutions'), /permission denied/);
      });
    });

    it('staat per medewerker per dag maar één inval toe die doorgaat', async () => {
      await expectError(insertSubstitution('2026-10-14', 'breda'), /substitutions_one_active_per_day/);
      await db.query(`update public.substitutions set status = 'not_needed' where date = '2026-10-14'`);
      await insertSubstitution('2026-10-14', 'breda', 'morning');
    });

    it('laat alleen invallen in een vestiging met een balie', async () => {
      await expectError(insertSubstitution('2026-10-20', 'logistics'), /alleen in een vestiging met een balie/);
    });

    it('zet afgehandeld alleen bij een inval die niet meer doorgaat', async () => {
      const id = await insertSubstitution('2026-10-21');
      await expectError(
        db.query('update public.substitutions set handled_at = now() where id = $1', [id]),
        /substitutions_handled_when_inactive/,
      );
      await db.query(`update public.substitutions set status = 'reschedule', handled_at = now() where id = $1`, [id]);
    });
  });

  describe('controle op achterhaalde invallen', () => {
    it('wijzigt alleen invallen die doorgaan, en logt dat als controle', async () => {
      const active = await insertSubstitution('2026-11-02');
      const result = await withSession(db, session(admin), () =>
        db.query<{ n: number }>('select public.apply_substitution_review($1::jsonb) as n', [
          JSON.stringify([
            { id: active, status: 'not_needed' },
            { id: active, status: 'reschedule' },
          ]),
        ]),
      );
      expect(result.rows[0]?.n).toBe(1);
      const row = await db.query<{ status: string }>('select status from public.substitutions where id = $1', [active]);
      expect(row.rows).toEqual([{ status: 'not_needed' }]);
      const log = await db.query<{ source: string; details: Record<string, unknown> }>(
        `select source, details from public.audit_log where entity = 'substitutions' and entity_id = $1
          and action = 'update' order by id desc limit 1`,
        [active],
      );
      expect(log.rows[0]).toEqual({ source: 'controle', details: { status: { old: 'active', new: 'not_needed' } } });
    });

    it('weigert een medewerker en een onbekende status', async () => {
      const id = await insertSubstitution('2026-11-03');
      await withSession(db, session(bas), async () => {
        await expectError(
          db.query('select public.apply_substitution_review($1::jsonb)', [JSON.stringify([{ id, status: 'not_needed' }])]),
          /Alleen een beheerder/,
        );
      });
      await withSession(db, session(admin), async () => {
        await expectError(
          db.query('select public.apply_substitution_review($1::jsonb)', [JSON.stringify([{ id, status: 'active' }])]),
          /Onbekende status/,
        );
      });
    });
  });

  describe('roosterwijzigingen voor één dag', () => {
    it('zet een wijziging en vervangt die bij een tweede keer', async () => {
      await withSession(db, session(admin), async () => {
        const first = await db.query<{ id: string }>(
          `select public.set_shift_override($1, '2026-10-14', 'shift', 'breda', 'counter', null, null) as id`,
          [bas.employeeId],
        );
        const second = await db.query<{ id: string }>(
          `select public.set_shift_override($1, '2026-10-14', 'off', null, null, null, null) as id`,
          [bas.employeeId],
        );
        expect(second.rows[0]?.id).toBe(first.rows[0]?.id);
      });
      const rows = await db.query('select kind, group_id, role from public.shift_overrides where employee_id = $1', [
        bas.employeeId,
      ]);
      expect(rows.rows).toEqual([{ kind: 'off', group_id: null, role: null }]);
    });

    it('verplaatst een dienst in één keer, maar niet naar dezelfde dag', async () => {
      await withSession(db, session(admin), async () => {
        await db.query(`select public.move_shift($1, '2026-10-20', '2026-10-24', 'den_bosch', 'counter', '09:00', '17:00')`, [
          bas.employeeId,
        ]);
        await expectError(
          db.query(`select public.move_shift($1, '2026-10-21', '2026-10-21', 'den_bosch', 'counter', null, null)`, [
            bas.employeeId,
          ]),
          /Kies een andere dag/,
        );
      });
      const rows = await db.query(
        `select date::text, kind, start_time::text from public.shift_overrides
          where employee_id = $1 and date in ('2026-10-20', '2026-10-24') order by date`,
        [bas.employeeId],
      );
      expect(rows.rows).toEqual([
        { date: '2026-10-20', kind: 'off', start_time: null },
        { date: '2026-10-24', kind: 'shift', start_time: '09:00:00' },
      ]);
    });

    it('laat een medewerker niets wijzigen, maar wel alles zien', async () => {
      await withSession(db, session(bas), async () => {
        await expectError(
          db.query(`select public.set_shift_override($1, '2026-10-27', 'off', null, null, null, null)`, [bas.employeeId]),
          /row-level security/,
        );
        const rows = await db.query('select * from public.shift_overrides');
        expect(rows.rows.length).toBeGreaterThan(0);
      });
    });

    it('bewaakt de vorm: geen dienst zonder groep en rol, geen zondag', async () => {
      await expectError(
        db.query(`insert into public.shift_overrides (employee_id, date, kind, group_id) values ($1, '2026-10-28', 'shift', 'breda')`, [
          bas.employeeId,
        ]),
        /shift_overrides_shape/,
      );
      await expectError(
        db.query(`insert into public.shift_overrides (employee_id, date, kind, group_id, role) values ($1, '2026-10-28', 'off', 'breda', 'counter')`, [
          bas.employeeId,
        ]),
        /shift_overrides_shape/,
      );
      await expectError(
        db.query(`insert into public.shift_overrides (employee_id, date, kind) values ($1, '2026-10-25', 'off')`, [bas.employeeId]),
        /shift_overrides_weekday/,
      );
    });
  });

  describe('genegeerde gaten', () => {
    it('zijn alleen voor beheerders', async () => {
      await withSession(db, session(admin), async () => {
        await db.query(`insert into public.gap_dismissals (group_id, date, day_part, shortage) values ('eindhoven', '2026-10-14', 'morning', 1)`);
        await db.query(`update public.gap_dismissals set shortage = 2 where group_id = 'eindhoven'`);
      });
      await withSession(db, session(bas), async () => {
        const rows = await db.query('select * from public.gap_dismissals');
        expect(rows.rows).toEqual([]);
        await expectError(
          db.query(`insert into public.gap_dismissals (group_id, date, day_part, shortage) values ('breda', '2026-10-14', 'morning', 1)`),
          /row-level security/,
        );
      });
    });
  });

  describe('logboek', () => {
    it('logt een inval met datum, vestiging, dagdeel en status, zonder namen', async () => {
      const id = await withSession(db, session(admin), () => insertSubstitution('2026-12-01', 'breda', 'afternoon'));
      const log = await db.query<{ employee_id: string; actor_employee_id: string; details: Record<string, unknown> }>(
        `select employee_id, actor_employee_id, details from public.audit_log
          where entity = 'substitutions' and entity_id = $1 and action = 'insert'`,
        [id],
      );
      expect(log.rows).toEqual([
        {
          employee_id: danique.employeeId,
          actor_employee_id: admin.employeeId,
          details: { date: '2026-12-01', group_id: 'breda', day_part: 'afternoon', status: 'active', handled_at: null },
        },
      ]);
      expect(JSON.stringify(log.rows)).not.toContain('Danique');
    });
  });
});
