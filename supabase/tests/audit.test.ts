import type { PGlite } from '@electric-sql/pglite';
import { beforeAll, describe, expect, it } from 'vitest';
import { createDatabase, createPerson, session, withSession, type TestPerson } from './helpers';

interface AuditRow {
  action: string;
  entity: string;
  entity_id: string | null;
  employee_id: string | null;
  actor_employee_id: string | null;
  changed_fields: string[] | null;
  details: Record<string, unknown> | null;
  source: string | null;
}

describe('logboek', () => {
  let db: PGlite;
  let admin: TestPerson;
  let sanne: TestPerson;

  async function latest(entity: string): Promise<AuditRow | undefined> {
    const result = await db.query<AuditRow>(
      `select action, entity, entity_id, employee_id, actor_employee_id, changed_fields, details, source
         from public.audit_log where entity = $1 order by id desc limit 1`,
      [entity],
    );
    return result.rows[0];
  }

  async function count(): Promise<number> {
    const result = await db.query<{ n: number }>('select count(*)::int as n from public.audit_log');
    return result.rows[0]?.n ?? 0;
  }

  beforeAll(async () => {
    db = await createDatabase();
    admin = await createPerson(db, { name: 'Anna', isAdmin: true, role: 'none', groupId: 'other' });
    sanne = await createPerson(db, { name: 'Sanne' });
  });

  it('legt de seed vast als setup', async () => {
    const result = await db.query<{ n: number }>(`select count(*)::int as n from public.audit_log where source = 'setup'`);
    expect(result.rows[0]?.n).toBeGreaterThan(0);
  });

  it('logt wie een afwezigheid invoert, met datums maar zonder persoonsgegevens', async () => {
    await withSession(db, session(admin), async () => {
      await db.query(
        `insert into public.absences (employee_id, start_date, end_date, status) values ($1, '2026-10-14', '2026-10-16', 'requested')`,
        [sanne.employeeId],
      );
    });
    expect(await latest('absences')).toMatchObject({
      action: 'insert',
      employee_id: sanne.employeeId,
      actor_employee_id: admin.employeeId,
      details: { start_date: '2026-10-14', end_date: '2026-10-16', day_part: 'full_day', status: 'requested' },
      source: null,
    });
  });

  it('logt bij een wijziging welke velden veranderden, met oude en nieuwe waarde', async () => {
    await withSession(db, session(admin), async () => {
      await db.query(`update public.absences set status = 'approved' where employee_id = $1`, [sanne.employeeId]);
    });
    expect(await latest('absences')).toMatchObject({
      action: 'update',
      changed_fields: ['status'],
      details: { status: { old: 'requested', new: 'approved' } },
    });
  });

  it('logt niets als er niets verandert', async () => {
    const before = await count();
    await withSession(db, session(admin), async () => {
      await db.query(`update public.absences set status = 'approved' where employee_id = $1`, [sanne.employeeId]);
    });
    expect(await count()).toBe(before);
  });

  it('logt nooit een e-mailadres of naam', async () => {
    await withSession(db, session(admin), async () => {
      await db.query(`update public.employee_accounts set email = 'sanne.nieuw@voorbeeld.nl' where employee_id = $1`, [
        sanne.employeeId,
      ]);
      await db.query(`update public.employees set name = 'Sanne de Vries' where id = $1`, [sanne.employeeId]);
    });
    expect(await latest('employee_accounts')).toMatchObject({ changed_fields: ['email'], details: null });
    expect(await latest('employees')).toMatchObject({ changed_fields: ['name'], details: null });
    const all = await db.query<{ text: string }>('select coalesce(string_agg(to_jsonb(a)::text, $1), $2) as text from public.audit_log a', [
      '\n',
      '',
    ]);
    const text = all.rows[0]?.text ?? '';
    expect(text).not.toContain('@');
    expect(text).not.toContain('Sanne');
  });

  it('logt agendalinks zonder de hash', async () => {
    await withSession(db, session(sanne), async () => {
      await db.query(`insert into public.calendar_feeds (employee_id, kind, token_hash) values ($1, 'absences', $2)`, [
        sanne.employeeId,
        'e'.repeat(64),
      ]);
    });
    const row = await latest('calendar_feeds');
    expect(row).toMatchObject({ action: 'insert', details: { kind: 'absences', group_id: null } });
    expect(JSON.stringify(row)).not.toContain('eeeeeeee');
  });

  it('logt verwijderen met de oude waarden', async () => {
    await withSession(db, session(admin), async () => {
      await db.query('delete from public.absences where employee_id = $1', [sanne.employeeId]);
    });
    expect(await latest('absences')).toMatchObject({ action: 'delete', details: { status: 'approved' } });
  });
});
