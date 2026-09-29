import { randomUUID } from 'node:crypto';
import type { PGlite } from '@electric-sql/pglite';
import { beforeAll, describe, expect, it } from 'vitest';
import { createDatabase, createPerson, expectError, session, setSession, withSession, type TestPerson } from './helpers';

const TOKEN_HASH_A = 'a'.repeat(64);
const TOKEN_HASH_B = 'b'.repeat(64);
const TOKEN_HASH_C = 'c'.repeat(64);

describe('rechten (RLS en grants)', () => {
  let db: PGlite;
  let anna: TestPerson; // beheerder
  let bas: TestPerson; // medewerker
  let cor: TestPerson; // inactief
  let dirk: TestPerson; // zonder e-mailadres
  let eef: TestPerson; // heeft een account, maar nog niet gekoppeld

  beforeAll(async () => {
    db = await createDatabase();
    anna = await createPerson(db, { name: 'Anna', isAdmin: true, role: 'none', groupId: 'other' });
    bas = await createPerson(db, { name: 'Bas' });
    cor = await createPerson(db, { name: 'Cor', isActive: false });
    dirk = await createPerson(db, { name: 'Dirk', email: null });
    eef = await createPerson(db, { name: 'Eef', linkUser: false });
    await db.query(
      `insert into public.absences (employee_id, start_date, end_date) values ($1, '2026-10-14', '2026-10-16')`,
      [bas.employeeId],
    );
  });

  it('geeft anon op niets toegang', async () => {
    await withSession(db, { role: 'anon' }, async () => {
      await expectError(db.query('select * from public.employees'), /permission denied/);
      await expectError(db.query('select * from public.absences'), /permission denied/);
      await expectError(db.query('select public.claim_account()'), /permission denied/);
    });
  });

  it('laat een medewerker de actieve collega’s, roosters en afwezigheid zien', async () => {
    await withSession(db, session(bas), async () => {
      const employees = await db.query<{ name: string }>('select name from public.employees order by name');
      expect(employees.rows.map((row) => row.name)).toEqual(['Anna', 'Bas', 'Dirk', 'Eef']);
      const absences = await db.query('select * from public.absences');
      expect(absences.rows).toHaveLength(1);
      const groups = await db.query('select * from public.groups');
      expect(groups.rows).toHaveLength(6);
    });
  });

  it('toont e-mailadressen alleen aan de medewerker zelf en de beheerder', async () => {
    await withSession(db, session(bas), async () => {
      const own = await db.query<{ email: string }>('select email from public.employee_accounts');
      expect(own.rows).toEqual([{ email: 'bas@voorbeeld.nl' }]);
    });
    await withSession(db, session(anna), async () => {
      const all = await db.query('select email from public.employee_accounts');
      expect(all.rows).toHaveLength(4);
    });
  });

  it('laat een medewerker niets wijzigen', async () => {
    await withSession(db, session(bas), async () => {
      await expectError(
        db.query(`insert into public.absences (employee_id, start_date, end_date) values ($1, '2026-11-02', '2026-11-02')`, [
          bas.employeeId,
        ]),
        /row-level security/,
      );
      await expectError(
        db.query(`insert into public.employees (name, group_id) values ('Nieuw', 'breda')`),
        /row-level security/,
      );
      const update = await db.query(`update public.employees set name = 'Hacker' where id = $1`, [bas.employeeId]);
      expect(update.affectedRows).toBe(0);
      const remove = await db.query('delete from public.absences');
      expect(remove.affectedRows).toBe(0);
      const log = await db.query('select * from public.audit_log');
      expect(log.rows).toEqual([]);
    });
  });

  it('laat de beheerder alles lezen en wijzigen', async () => {
    await withSession(db, session(anna), async () => {
      const employees = await db.query('select name from public.employees');
      expect(employees.rows).toHaveLength(5);
      const inserted = await db.query<{ id: string }>(
        `insert into public.absences (employee_id, start_date, end_date, day_part, status)
         values ($1, '2026-11-02', '2026-11-02', 'morning', 'requested') returning id`,
        [dirk.employeeId],
      );
      const id = inserted.rows[0]?.id;
      const approved = await db.query(`update public.absences set status = 'approved' where id = $1`, [id]);
      expect(approved.affectedRows).toBe(1);
      const removed = await db.query('delete from public.absences where id = $1', [id]);
      expect(removed.affectedRows).toBe(1);
    });
  });

  it('laat niemand via de client een inlogaccount koppelen', async () => {
    await withSession(db, session(anna), async () => {
      await expectError(
        db.query('update public.employee_accounts set user_id = $1 where employee_id = $2', [anna.userId, dirk.employeeId]),
        /permission denied/,
      );
    });
  });

  it('laat een inactieve medewerker niets zien', async () => {
    await withSession(db, session(cor), async () => {
      expect((await db.query('select * from public.employees')).rows).toEqual([]);
      expect((await db.query('select * from public.absences')).rows).toEqual([]);
      expect((await db.query('select * from public.employee_accounts')).rows).toEqual([]);
    });
  });

  it('koppelt een account bij het inloggen via claim_account()', async () => {
    await withSession(db, session(eef), async () => {
      expect((await db.query('select * from public.employees')).rows).toEqual([]);
      const claimed = await db.query<{ claim_account: string }>('select public.claim_account()');
      expect(claimed.rows[0]?.claim_account).toBe(eef.employeeId);
      expect((await db.query('select * from public.employees')).rows.length).toBeGreaterThan(0);
    });
  });

  it('koppelt niets als het e-mailadres niet bekend is', async () => {
    const stranger = randomUUID();
    await db.query('insert into auth.users (id, email) values ($1, $2)', [stranger, 'vreemde@voorbeeld.nl']);
    await withSession(db, { role: 'authenticated', userId: stranger, email: 'vreemde@voorbeeld.nl' }, async () => {
      const claimed = await db.query<{ claim_account: string | null }>('select public.claim_account()');
      expect(claimed.rows[0]?.claim_account).toBeNull();
      expect((await db.query('select * from public.employees')).rows).toEqual([]);
    });
  });

  it('houdt altijd minstens één actieve beheerder over', async () => {
    await withSession(db, session(anna), async () => {
      await expectError(
        db.query('update public.employees set is_admin = false where id = $1', [anna.employeeId]),
        /minstens één actieve beheerder/,
      );
      await db.query('update public.employees set is_admin = true where id = $1', [bas.employeeId]);
      await db.query('update public.employees set is_admin = false where id = $1', [bas.employeeId]);
    });
  });

  describe('agendalinks', () => {
    it('laat je alleen voor jezelf een link maken', async () => {
      await withSession(db, session(bas), async () => {
        await db.query(`insert into public.calendar_feeds (employee_id, kind, token_hash) values ($1, 'personal', $2)`, [
          bas.employeeId,
          TOKEN_HASH_A,
        ]);
        await expectError(
          db.query(`insert into public.calendar_feeds (employee_id, kind, token_hash) values ($1, 'personal', $2)`, [
            anna.employeeId,
            TOKEN_HASH_B,
          ]),
          /row-level security/,
        );
      });
    });

    it('staat per feed maar één actieve link toe', async () => {
      await withSession(db, session(bas), async () => {
        await expectError(
          db.query(`insert into public.calendar_feeds (employee_id, kind, token_hash) values ($1, 'personal', $2)`, [
            bas.employeeId,
            TOKEN_HASH_B,
          ]),
          /duplicate key/,
        );
      });
    });

    it('laat eigenaar en beheerder intrekken, maar niet terugzetten', async () => {
      await withSession(db, session(anna), async () => {
        const visible = await db.query('select * from public.calendar_feeds where employee_id = $1', [bas.employeeId]);
        expect(visible.rows).toHaveLength(1);
      });
      await withSession(db, session(bas), async () => {
        const revoked = await db.query(
          `update public.calendar_feeds set revoked_at = now() where employee_id = $1 and revoked_at is null`,
          [bas.employeeId],
        );
        expect(revoked.affectedRows).toBe(1);
        const back = await db.query(`update public.calendar_feeds set revoked_at = null where employee_id = $1`, [
          bas.employeeId,
        ]);
        expect(back.affectedRows).toBe(0);
        await db.query(`insert into public.calendar_feeds (employee_id, kind, token_hash) values ($1, 'personal', $2)`, [
          bas.employeeId,
          TOKEN_HASH_C,
        ]);
      });
    });

    it('verbergt de links van anderen', async () => {
      await withSession(db, session(eef), async () => {
        const feeds = await db.query('select * from public.calendar_feeds');
        expect(feeds.rows).toEqual([]);
      });
    });
  });

  it('herstelt na elke test de rol postgres', async () => {
    await setSession(db, null);
    const role = await db.query<{ current_user: string }>('select current_user');
    expect(role.rows[0]?.current_user).toBe('postgres');
  });
});
