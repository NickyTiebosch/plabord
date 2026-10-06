import type { PGlite } from '@electric-sql/pglite';
import { beforeAll, describe, expect, it } from 'vitest';
import { createDatabase, createPerson, expectError, session, withSession, type TestPerson } from './helpers';

// Sleutels in de vorm die een browser geeft: base64url zonder '=', 65 en 16 bytes.
const P256DH = `B${'A'.repeat(86)}`;
const AUTH = 'A'.repeat(22);
const FCM = (token: string) => `https://fcm.googleapis.com/fcm/send/${token}`;

describe('fase 4: pushmeldingen', () => {
  let db: PGlite;
  let admin: TestPerson;
  let bas: TestPerson;
  let eva: TestPerson;

  beforeAll(async () => {
    db = await createDatabase();
    admin = await createPerson(db, { name: 'Anna', isAdmin: true, role: 'none', groupId: 'other' });
    bas = await createPerson(db, { name: 'Bas' });
    eva = await createPerson(db, { name: 'Eva', groupId: 'eindhoven' });
  });

  function register(person: TestPerson, endpoint: string, p256dh = P256DH, auth = AUTH) {
    return withSession(db, session(person), () =>
      db.query('select public.register_push_subscription($1, $2, $3)', [endpoint, p256dh, auth]),
    );
  }

  async function ownerOf(endpoint: string): Promise<string | null> {
    const result = await db.query<{ employee_id: string }>(
      'select employee_id from public.push_subscriptions where endpoint = $1',
      [endpoint],
    );
    return result.rows[0]?.employee_id ?? null;
  }

  describe('een toestel aanmelden', () => {
    it('zet meldingen aan op een eigen toestel; iedereen ziet alleen de eigen toestellen', async () => {
      await register(bas, FCM('bas-telefoon'));
      await register(eva, FCM('eva-telefoon'));
      const seenByBas = await withSession(db, session(bas), () =>
        db.query<{ endpoint: string }>('select endpoint from public.push_subscriptions order by endpoint'),
      );
      expect(seenByBas.rows).toEqual([{ endpoint: FCM('bas-telefoon') }]);
      const seenByAdmin = await withSession(db, session(admin), () =>
        db.query<{ endpoint: string }>('select endpoint from public.push_subscriptions order by endpoint'),
      );
      expect(seenByAdmin.rows.map((row) => row.endpoint)).toEqual([FCM('bas-telefoon'), FCM('eva-telefoon')]);
      await withSession(db, { role: 'anon' }, async () => {
        await expectError(db.query('select * from public.push_subscriptions'), /permission denied/);
        await expectError(
          db.query('select public.register_push_subscription($1, $2, $3)', [FCM('anon'), P256DH, AUTH]),
          /permission denied/,
        );
      });
    });

    it('accepteert alleen https-adressen van de bekende pushdiensten', async () => {
      await register(bas, 'https://web.push.apple.com/QGy3T9ghqb');
      await register(bas, 'https://updates.push.services.mozilla.com/wpush/v2/gAAAAA');
      await register(bas, 'https://wns2-par02p.notify.windows.com/w/?token=BQYAAAB');
      for (const endpoint of [
        'http://fcm.googleapis.com/fcm/send/x',
        'https://voorbeeld.nl/push',
        'https://fcm.googleapis.com.voorbeeld.nl/fcm/send/x',
        'https://localhost/push',
        'https://169.254.169.254/latest',
      ]) {
        await expectError(register(bas, endpoint), /push_subscriptions_endpoint_known/);
      }
      await expectError(register(bas, FCM('sleutel'), 'te-kort', AUTH), /push_subscriptions_keys/);
      await expectError(register(bas, FCM('geheim'), P256DH, 'x'), /push_subscriptions_keys/);
    });

    it('geeft een toestel aan wie het als laatste aanmeldt', async () => {
      await register(bas, FCM('gedeeld'));
      expect(await ownerOf(FCM('gedeeld'))).toBe(bas.employeeId);
      await register(eva, FCM('gedeeld'));
      expect(await ownerOf(FCM('gedeeld'))).toBe(eva.employeeId);
      // Opnieuw aanmelden met nieuwe sleutels werkt de sleutels bij.
      await register(eva, FCM('gedeeld'), `B${'C'.repeat(86)}`, 'D'.repeat(22));
      const keys = await db.query('select p256dh, auth from public.push_subscriptions where endpoint = $1', [FCM('gedeeld')]);
      expect(keys.rows).toEqual([{ p256dh: `B${'C'.repeat(86)}`, auth: 'D'.repeat(22) }]);
    });

    it('is niet voor een inactieve medewerker', async () => {
      const oud = await createPerson(db, { name: 'Oud' });
      await db.query('update public.employees set is_active = false where id = $1', [oud.employeeId]);
      await expectError(register(oud, FCM('oud')), /actieve medewerker/);
    });

    it('houdt per medewerker hooguit tien toestellen; het oudste verdwijnt', async () => {
      const lotte = await createPerson(db, { name: 'Lotte', groupId: 'eindhoven' });
      for (let index = 0; index < 10; index++) await register(lotte, FCM(`lotte-${index}`));
      await db.query(`update public.push_subscriptions set created_at = now() - interval '1 day' where endpoint = $1`, [
        FCM('lotte-3'),
      ]);
      await register(lotte, FCM('lotte-nieuw'));
      const left = await db.query<{ endpoint: string }>('select endpoint from public.push_subscriptions where employee_id = $1', [
        lotte.employeeId,
      ]);
      expect(left.rows).toHaveLength(10);
      expect(left.rows.map((row) => row.endpoint)).not.toContain(FCM('lotte-3'));
      expect(left.rows.map((row) => row.endpoint)).toContain(FCM('lotte-nieuw'));
    });
  });

  describe('rechten op de abonnementen', () => {
    it('laat een medewerker niet zelf invoegen of wijzigen', async () => {
      await withSession(db, session(bas), async () => {
        await expectError(
          db.query('insert into public.push_subscriptions (employee_id, endpoint, p256dh, auth) values ($1, $2, $3, $4)', [
            bas.employeeId,
            FCM('direct'),
            P256DH,
            AUTH,
          ]),
          /permission denied/,
        );
        const updated = await db.query('update public.push_subscriptions set last_success_at = now() returning id');
        expect(updated.rows).toEqual([]);
        await expectError(db.query(`update public.push_subscriptions set endpoint = 'x'`), /permission denied/);
      });
      await withSession(db, session(admin), async () => {
        const updated = await db.query('update public.push_subscriptions set last_success_at = now() where endpoint = $1 returning id', [
          FCM('bas-telefoon'),
        ]);
        expect(updated.rows).toHaveLength(1);
      });
    });

    it('laat een medewerker alleen de eigen toestellen uitzetten; een beheerder ruimt alles op', async () => {
      await register(eva, FCM('eva-tablet'));
      const byBas = await withSession(db, session(bas), () =>
        db.query('delete from public.push_subscriptions where endpoint = $1 returning id', [FCM('eva-tablet')]),
      );
      expect(byBas.rows).toEqual([]);
      const own = await withSession(db, session(bas), () =>
        db.query('delete from public.push_subscriptions where endpoint = $1 returning id', [FCM('bas-telefoon')]),
      );
      expect(own.rows).toHaveLength(1);
      const byAdmin = await withSession(db, session(admin), () =>
        db.query('delete from public.push_subscriptions where endpoint = $1 returning id', [FCM('eva-tablet')]),
      );
      expect(byAdmin.rows).toHaveLength(1);
    });
  });

  describe('bij de mails en bij volledig verwijderen', () => {
    it('houdt bij elke mail bij naar hoeveel toestellen de push ging', async () => {
      await withSession(db, session(admin), async () => {
        const queued = await db.query<{ id: string }>(
          `insert into public.mail_queue (employee_id, kind, dates) values ($1, 'day_changed', '{2026-10-14}') returning id`,
          [bas.employeeId],
        );
        const id = queued.rows[0]?.id;
        const updated = await db.query<{ push_devices: number }>(
          'update public.mail_queue set push_devices = 2 where id = $1 returning push_devices',
          [id],
        );
        expect(updated.rows).toEqual([{ push_devices: 2 }]);
        await expectError(db.query('update public.mail_queue set push_devices = -1 where id = $1', [id]), /mail_queue_push_devices/);
      });
    });

    it('verwijdert de toestellen mee en telt ze in het logboek', async () => {
      const finn = await createPerson(db, { name: 'Finn' });
      await register(finn, FCM('finn-1'));
      await register(finn, FCM('finn-2'));
      await db.query('update public.employees set is_active = false where id = $1', [finn.employeeId]);
      const result = await withSession(db, session(admin), () =>
        db.query<{ counts: Record<string, unknown> }>('select public.delete_employee($1) as counts', [finn.employeeId]),
      );
      expect(result.rows[0]?.counts).toMatchObject({ push_subscriptions: 2, account: true });
      const left = await db.query<{ count: number }>(
        'select count(*)::int as count from public.push_subscriptions where employee_id = $1',
        [finn.employeeId],
      );
      expect(left.rows[0]?.count).toBe(0);
    });
  });
  describe('de uitnodiging (V33)', () => {
    function queueInvite(employeeId: string, dates: string[] = []) {
      return db.query<{ id: string }>(
        `insert into public.mail_queue (employee_id, kind, dates) values ($1, 'invite', $2) returning id`,
        [employeeId, dates],
      );
    }

    it('zet een beheerder in de wachtrij, zonder datums', async () => {
      await withSession(db, session(admin), async () => {
        const queued = await queueInvite(bas.employeeId);
        expect(queued.rows).toHaveLength(1);
        const rows = await db.query<{ kind: string; dates: string[]; status: string }>(
          'select kind, dates, status from public.mail_queue where id = $1',
          [queued.rows[0]?.id],
        );
        expect(rows.rows).toEqual([{ kind: 'invite', dates: [], status: 'pending' }]);
      });
    });

    it('heeft nooit datums, en een medewerker kan er geen versturen', async () => {
      await withSession(db, session(admin), async () => {
        await expectError(queueInvite(bas.employeeId, ['2026-10-14']), /mail_queue_dates/);
      });
      await withSession(db, session(bas), async () => {
        await expectError(queueInvite(bas.employeeId), /row-level security|permission denied/);
      });
    });

    it('laat de andere soorten zoals ze waren: een testmail zonder datums, de rest met', async () => {
      await withSession(db, session(admin), async () => {
        await db.query(`insert into public.mail_queue (employee_id, kind, dates) values ($1, 'test', '{}')`, [admin.employeeId]);
        await expectError(
          db.query(`insert into public.mail_queue (employee_id, kind, dates) values ($1, 'day_changed', '{}')`, [bas.employeeId]),
          /mail_queue_dates/,
        );
      });
    });
  });
});
