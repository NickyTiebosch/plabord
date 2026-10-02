import type { PGlite } from '@electric-sql/pglite';
import { beforeAll, describe, expect, it } from 'vitest';
import { createDatabase, createPerson, expectError, session, withSession, type TestPerson } from './helpers';

describe('fase 3: mails, export en volledig verwijderen', () => {
  let db: PGlite;
  let admin: TestPerson;
  let bas: TestPerson; // medewerker

  beforeAll(async () => {
    db = await createDatabase();
    admin = await createPerson(db, { name: 'Anna', isAdmin: true, role: 'none', groupId: 'other' });
    bas = await createPerson(db, { name: 'Bas' });
  });

  async function queueMail(employeeId: string, kind: string, dates: string[], status = 'pending') {
    // Zoals de app: een verstuurde mail heeft een tijdstip (alleen de server zet dat direct).
    const sql =
      status === 'sent'
        ? `insert into public.mail_queue (employee_id, kind, dates, status, sent_at) values ($1, $2, $3, $4, now()) returning id`
        : `insert into public.mail_queue (employee_id, kind, dates, status) values ($1, $2, $3, $4) returning id`;
    const result = await db.query<{ id: string }>(sql, [employeeId, kind, dates, status]);
    return result.rows[0]?.id ?? '';
  }

  describe('de wachtrij voor mails', () => {
    it('is voor beheerders: zetten, lezen en de status bijwerken', async () => {
      await withSession(db, session(admin), async () => {
        const id = await queueMail(bas.employeeId, 'substitution_assigned', ['2026-10-14']);
        const updated = await db.query(
          `update public.mail_queue set status = 'sent', sent_at = now(), attempts = 1 where id = $1 returning id`,
          [id],
        );
        expect(updated.rows).toHaveLength(1);
        const rows = await db.query<{ status: string }>('select status from public.mail_queue where id = $1', [id]);
        expect(rows.rows).toEqual([{ status: 'sent' }]);
      });
    });

    it('is onzichtbaar voor een medewerker, en anon kan niets', async () => {
      await withSession(db, session(bas), async () => {
        const rows = await db.query('select * from public.mail_queue');
        expect(rows.rows).toEqual([]);
        await expectError(queueMail(bas.employeeId, 'test', []), /row-level security/);
      });
      await withSession(db, { role: 'anon' }, async () => {
        await expectError(db.query('select * from public.mail_queue'), /permission denied/);
      });
    });

    it('laat een beheerder niets verwijderen; opruimen doet alleen de server', async () => {
      await withSession(db, session(admin), async () => {
        await expectError(db.query('delete from public.mail_queue'), /permission denied/);
      });
      await withSession(db, { role: 'service_role' }, async () => {
        const id = await queueMail(bas.employeeId, 'test', [], 'skipped');
        const deleted = await db.query('delete from public.mail_queue where id = $1 returning id', [id]);
        expect(deleted.rows).toHaveLength(1);
      });
    });

    it('stuurt per persoon per dag hooguit één herinnering', async () => {
      await queueMail(bas.employeeId, 'reminder', ['2026-10-20']);
      await expectError(queueMail(bas.employeeId, 'reminder', ['2026-10-20']), /mail_queue_one_reminder_per_day/);
      await queueMail(bas.employeeId, 'reminder', ['2026-10-21']);
      await queueMail(bas.employeeId, 'day_changed', ['2026-10-20']);
    });

    it('bewaakt de vorm: bekende soorten en statussen, en de juiste dagen', async () => {
      await expectError(queueMail(bas.employeeId, 'nieuwsbrief', ['2026-10-20']), /mail_queue_kind/);
      await expectError(queueMail(bas.employeeId, 'test', [], 'gelezen'), /mail_queue_status/);
      await expectError(queueMail(bas.employeeId, 'reminder', ['2026-10-22', '2026-10-23']), /mail_queue_dates/);
      await expectError(queueMail(bas.employeeId, 'day_changed', []), /mail_queue_dates/);
      await expectError(
        db.query(`update public.mail_queue set status = 'sent' where kind = 'day_changed'`),
        /mail_queue_sent/,
      );
    });

    it('bewaart geen adres of tekst: alleen wie, welke dagen, welk soort en de status', async () => {
      const columns = await db.query<{ column_name: string }>(
        `select column_name from information_schema.columns
          where table_schema = 'public' and table_name = 'mail_queue' order by ordinal_position`,
      );
      expect(columns.rows.map((row) => row.column_name)).toEqual([
        'id',
        'employee_id',
        'kind',
        'dates',
        'status',
        'attempts',
        'last_error',
        'created_at',
        'updated_at',
        'sent_at',
      ]);
    });
  });

  describe('de schakelaar mails versturen', () => {
    it('staat na de installatie uit', async () => {
      const result = await db.query<{ mail_enabled: boolean }>('select mail_enabled from public.settings');
      expect(result.rows).toEqual([{ mail_enabled: false }]);
    });

    it('kan alleen een beheerder omzetten, en dat staat in het logboek', async () => {
      await withSession(db, session(bas), async () => {
        const updated = await db.query('update public.settings set mail_enabled = true returning id');
        expect(updated.rows).toEqual([]);
      });
      await withSession(db, session(admin), async () => {
        await db.query('update public.settings set mail_enabled = true');
      });
      const log = await db.query<{ details: unknown }>(
        `select details from public.audit_log where entity = 'settings' and action = 'update' order by id desc limit 1`,
      );
      expect(log.rows[0]?.details).toEqual({ mail_enabled: { old: false, new: true } });
      await db.query('update public.settings set mail_enabled = false');
    });
  });

  describe('export in het logboek', () => {
    it('legt vast wie welke export maakte', async () => {
      await withSession(db, session(admin), async () => {
        await db.query(`select public.log_export('planning', null)`);
        await db.query(`select public.log_export('employee', $1)`, [bas.employeeId]);
      });
      const log = await db.query<{ action: string; entity: string; employee_id: string | null; details: unknown; actor: string }>(
        `select action, entity, employee_id, details, actor_employee_id as actor
           from public.audit_log where entity = 'export' order by id`,
      );
      expect(log.rows).toEqual([
        { action: 'insert', entity: 'export', employee_id: null, details: { kind: 'planning' }, actor: admin.employeeId },
        { action: 'insert', entity: 'export', employee_id: bas.employeeId, details: { kind: 'employee' }, actor: admin.employeeId },
      ]);
    });

    it('weigert een medewerker en een onbekende export', async () => {
      await withSession(db, session(bas), async () => {
        await expectError(db.query(`select public.log_export('planning', null)`), /beheerder/);
      });
      await withSession(db, session(admin), async () => {
        await expectError(db.query(`select public.log_export('alles', null)`), /Onbekende export/);
        await expectError(db.query(`select public.log_export('employee', null)`), /medewerker/);
      });
    });
  });

  describe('een medewerker volledig verwijderen', () => {
    async function fillWithData(person: TestPerson) {
      const id = person.employeeId;
      await db.query(`insert into public.counter_eligibility (employee_id, group_id) values ($1, 'breda')`, [id]);
      await db.query(
        `insert into public.recurring_shifts (employee_id, weekday, group_id, role, valid_from) values
           ($1, 1, 'den_bosch', 'counter', '2026-01-01'), ($1, 2, 'den_bosch', 'counter', '2026-01-01')`,
        [id],
      );
      await db.query(`insert into public.absences (employee_id, start_date, end_date) values ($1, '2026-10-14', '2026-10-16')`, [id]);
      await db.query(`insert into public.substitutions (employee_id, date, group_id) values ($1, '2026-11-03', 'breda')`, [id]);
      await db.query(`insert into public.shift_overrides (employee_id, date, kind) values ($1, '2026-11-04', 'off')`, [id]);
      await db.query(
        `insert into public.calendar_feeds (employee_id, kind, token_hash) values ($1, 'personal', $2)`,
        [id, 'd'.repeat(64)],
      );
      await queueMail(id, 'substitution_assigned', ['2026-11-03'], 'sent');
    }

    it('kan alleen bij een inactieve medewerker, en alleen door een beheerder', async () => {
      const eva = await createPerson(db, { name: 'Eva' });
      await withSession(db, session(admin), async () => {
        await expectError(db.query('select public.delete_employee($1)', [eva.employeeId]), /inactief/);
      });
      await db.query('update public.employees set is_active = false where id = $1', [eva.employeeId]);
      await withSession(db, session(bas), async () => {
        await expectError(db.query('select public.delete_employee($1)', [eva.employeeId]), /beheerder/);
      });
      await withSession(db, session(admin), async () => {
        await expectError(db.query('select public.delete_employee($1)', [admin.employeeId]), /inactief|jezelf/);
      });
    });

    it('verwijdert alles van die persoon en zet één regel in het logboek', async () => {
      const finn = await createPerson(db, { name: 'Finn' });
      await fillWithData(finn);
      await db.query('update public.employees set is_active = false where id = $1', [finn.employeeId]);
      const before = await db.query<{ count: number }>(
        'select count(*)::int as count from public.audit_log where employee_id = $1',
        [finn.employeeId],
      );
      const lastId = await db.query<{ id: number }>('select max(id)::int as id from public.audit_log');

      const result = await withSession(db, session(admin), () =>
        db.query<{ counts: unknown }>('select public.delete_employee($1) as counts', [finn.employeeId]),
      );
      expect(result.rows[0]?.counts).toEqual({
        recurring_shifts: 2,
        absences: 1,
        substitutions: 1,
        shift_overrides: 1,
        calendar_feeds: 1,
        account: true,
      });

      const left = await db.query<{ total: number }>(
        `select (select count(*) from public.employees where id = $1)
              + (select count(*) from public.employee_accounts where employee_id = $1)
              + (select count(*) from public.counter_eligibility where employee_id = $1)
              + (select count(*) from public.recurring_shifts where employee_id = $1)
              + (select count(*) from public.absences where employee_id = $1)
              + (select count(*) from public.substitutions where employee_id = $1)
              + (select count(*) from public.shift_overrides where employee_id = $1)
              + (select count(*) from public.calendar_feeds where employee_id = $1)
              + (select count(*) from public.mail_queue where employee_id = $1) as total`,
        [finn.employeeId],
      );
      expect(Number(left.rows[0]?.total)).toBe(0);

      const added = await db.query<{ action: string; entity: string; entity_id: string; source: string; actor: string }>(
        `select action, entity, entity_id, source, actor_employee_id as actor
           from public.audit_log where id > $1 order by id`,
        [lastId.rows[0]?.id ?? 0],
      );
      expect(added.rows).toEqual([
        { action: 'delete', entity: 'employees', entity_id: finn.employeeId, source: 'verwijderen', actor: admin.employeeId },
      ]);
      // De oude regels blijven; daarin staan alleen id's.
      const after = await db.query<{ count: number }>(
        'select count(*)::int as count from public.audit_log where employee_id = $1',
        [finn.employeeId],
      );
      expect(after.rows[0]?.count).toBe((before.rows[0]?.count ?? 0) + 1);
    });

    it('logt gewone wijzigingen daarna weer zoals altijd', async () => {
      await withSession(db, session(admin), async () => {
        await db.query(`insert into public.absences (employee_id, start_date, end_date) values ($1, '2026-12-01', '2026-12-01')`, [
          bas.employeeId,
        ]);
      });
      const log = await db.query<{ source: string | null }>(
        `select source from public.audit_log where entity = 'absences' order by id desc limit 1`,
      );
      expect(log.rows).toEqual([{ source: null }]);
    });
  });
});
