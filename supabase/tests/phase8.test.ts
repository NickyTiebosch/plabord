import type { PGlite } from '@electric-sql/pglite';
import { beforeAll, describe, expect, it } from 'vitest';
import { createDatabase, createPerson, expectError, session, setupSql, withSession, type TestPerson } from './helpers';

describe('fase 8: locatie van huurauto’s', () => {
  let db: PGlite;
  let anna: TestPerson; // beheerder
  let tess: TestPerson; // teamleider
  let bas: TestPerson; // medewerker
  let achter: string;
  let zijkant: string;

  const as = <T>(person: TestPerson, run: () => Promise<T>) => withSession(db, session(person), run);
  const value = async <T>(sql: string, params: unknown[] = []) => (await db.query<{ v: T }>(sql, params)).rows[0]?.v;

  beforeAll(async () => {
    db = await createDatabase();
    anna = await createPerson(db, { name: 'Anna', isAdmin: true, role: 'none', groupId: 'other' });
    tess = await createPerson(db, { name: 'Tess', role: 'none', groupId: 'other' });
    bas = await createPerson(db, { name: 'Bas' });
    await db.query('update public.employees set is_team_lead = true where id = $1', [tess.employeeId]);
    achter = (await value<string>(`select id as v from public.parking_spots where group_id = 'den_bosch' and name = 'Achter'`)) ?? '';
    zijkant = (await value<string>(`select id as v from public.parking_spots where group_id = 'den_bosch' and name = 'Zijkant'`)) ?? '';
  });

  it('zet de plekken van Den Bosch klaar, en zet ze bij opnieuw draaien niet terug (V73)', async () => {
    const names = await db.query(`select name from public.parking_spots order by group_id, sort_order`);
    expect(names.rows.map((row) => (row as { name: string }).name)).toEqual(['Zijkant', 'Achter', 'S 18', 'S 20', 'S 22']);
    await as(anna, () => db.query(`delete from public.parking_spots where name = 'S 22'`));
    await db.exec(setupSql());
    expect(await value(`select count(*)::int as v from public.parking_spots`)).toBe(4);
  });

  it('laat alleen de beheerder plekken beheren', async () => {
    await as(tess, () => expectError(db.query(`insert into public.parking_spots (group_id, name) values ('eindhoven', 'Voor')`), /row-level security/));
    await as(anna, () => db.query(`insert into public.parking_spots (group_id, name) values ('eindhoven', 'Voor')`));
    await as(anna, () => expectError(db.query(`insert into public.parking_spots (group_id, name) values ('logistics', 'Voor')`), /parking_spots_group_fkey|foreign key/));
    await as(anna, () => expectError(db.query(`insert into public.parking_spots (group_id, name) values ('eindhoven', 'Voor')`), /parking_spots_name_key/));
  });

  it('zet een auto op een plek, verhuist hem, en vult het model aan uit Mobiliteit (V74, V75)', async () => {
    await db.query(
      `insert into public.vehicle_loans (group_id, license_plate, model, destination, handed_to, handed_out_at)
       values ('den_bosch', 'GHP39K', 'Audi A4 Avant', 'mobility', 'Mobiliteit', now() - interval '1 day')`,
    );
    await as(bas, () => db.query(`select public.place_vehicle('GHP39K', $1, null)`, [achter]));
    let row = await db.query(`select spot_id, model, moved_by from public.vehicle_locations where license_plate = 'GHP39K'`);
    expect(row.rows).toEqual([{ spot_id: achter, model: 'Audi A4 Avant', moved_by: bas.employeeId }]);
    await as(tess, () => db.query(`select public.place_vehicle('GHP39K', $1, '')`, [zijkant]));
    row = await db.query(`select spot_id, model, moved_by from public.vehicle_locations`);
    expect(row.rows).toEqual([{ spot_id: zijkant, model: 'Audi A4 Avant', moved_by: tess.employeeId }]);
    await as(bas, () => expectError(db.query(`select public.place_vehicle('ghp-39', $1, null)`, [achter]), /kenteken/));
    // Iedereen leest, schrijven alleen via de functies.
    expect(await as(bas, () => value<number>(`select count(*)::int as v from public.vehicle_locations`))).toBe(1);
    await as(bas, () => expectError(db.query(`update public.vehicle_locations set spot_id = $1`, [achter]), /permission denied/));
    // Elke verplaatsing staat in het logboek.
    const log = await db.query(`select action from public.audit_log where entity = 'vehicle_locations' order by id`);
    expect(log.rows).toEqual([{ action: 'insert' }, { action: 'update' }]);
  });

  it('kan een plek met auto’s niet verwijderen, wel op inactief zetten; een inactieve plek neemt geen auto’s', async () => {
    await as(anna, () => expectError(db.query('delete from public.parking_spots where id = $1', [zijkant]), /vehicle_locations_spot_fkey|foreign key/));
    await as(anna, () => db.query('update public.parking_spots set is_active = false where id = $1', [achter]));
    await as(bas, () => expectError(db.query(`select public.place_vehicle('X221LB', $1, null)`, [achter]), /bestaat niet/));
    await as(anna, () => db.query('update public.parking_spots set is_active = true where id = $1', [achter]));
  });

  it('haalt een auto weg van het terrein', async () => {
    expect(await as(bas, () => value<boolean>(`select public.remove_vehicle('GHP39K') as v`))).toBe(true);
    expect(await as(bas, () => value<boolean>(`select public.remove_vehicle('GHP39K') as v`))).toBe(false);
  });

  it('leest de startlijst in, alleen door de beheerder, en voegt onbekende plekken toe', async () => {
    const rows = JSON.stringify([
      { plate: 'ZZ104X', spot: 'S 18' },
      { plate: 'ZZ103X', spot: 'Zijkant', model: 'VW Golf' },
      { plate: 'ZZ102X', spot: 'Achter' },
      { plate: 'TT001X', spot: 'Wasstraat' },
    ]);
    await as(tess, () => expectError(db.query(`select public.import_locations('den_bosch', $1)`, [rows]), /beheerder/));
    expect(await as(anna, () => value<number>(`select public.import_locations('den_bosch', $1) as v`, [rows]))).toBe(4);
    expect(await value(`select count(*)::int as v from public.parking_spots where group_id = 'den_bosch' and name = 'Wasstraat'`)).toBe(1);
    expect(await value(`select model as v from public.vehicle_locations where license_plate = 'ZZ103X'`)).toBe('VW Golf');
    expect(await as(anna, () => value<number>(`select public.import_locations('den_bosch', $1) as v`, [rows]))).toBe(4);
    expect(await value(`select count(*)::int as v from public.vehicle_locations`)).toBe(4);
  });

  it('laat de teamleider de locatie exporteren, en een medewerker niet', async () => {
    await as(tess, () => db.query(`select public.log_export('locations', null)`));
    await as(bas, () => expectError(db.query(`select public.log_export('locations', null)`), /beheerder of teamleider/));
  });
});

describe('fase 8: overdracht per vestiging', () => {
  let db: PGlite;
  let tess: TestPerson; // teamleider
  let bas: TestPerson; // medewerker
  let eva: TestPerson; // medewerker
  const as = <T>(person: TestPerson, run: () => Promise<T>) => withSession(db, session(person), run);

  beforeAll(async () => {
    db = await createDatabase();
    tess = await createPerson(db, { name: 'Tess', role: 'none', groupId: 'other' });
    bas = await createPerson(db, { name: 'Bas' });
    eva = await createPerson(db, { name: 'Eva', groupId: 'eindhoven' });
    await db.query('update public.employees set is_team_lead = true where id = $1', [tess.employeeId]);
  });

  it('schrijft een notitie op eigen naam; de schrijver wijzigt hem vandaag, een ander niet, de teamleider wel', async () => {
    const id = await as(bas, async () =>
      (await db.query<{ id: string }>(`insert into public.handover_notes (group_id, body) values ('den_bosch', 'Sleutel S 18 ligt in de kluis') returning id`)).rows[0]?.id,
    );
    const row = await db.query(`select created_by from public.handover_notes where id = $1`, [id]);
    expect(row.rows).toEqual([{ created_by: bas.employeeId }]);
    expect((await as(eva, () => db.query(`update public.handover_notes set body = 'x' where id = $1`, [id]))).affectedRows).toBe(0);
    expect((await as(bas, () => db.query(`update public.handover_notes set body = 'Sleutel ligt in de kluis' where id = $1`, [id]))).affectedRows).toBe(1);
    // Gisteren geschreven: dan alleen de teamleider.
    await db.query(`update public.handover_notes set created_at = now() - interval '1 day' where id = $1`, [id]);
    expect((await as(bas, () => db.query(`delete from public.handover_notes where id = $1`, [id]))).affectedRows).toBe(0);
    expect((await as(tess, () => db.query(`update public.handover_notes set body = 'Kluis' where id = $1`, [id]))).affectedRows).toBe(1);
    await as(bas, () => expectError(db.query(`insert into public.handover_notes (group_id, body) values ('logistics', 'x')`), /handover_notes_group_fkey|foreign key/));
  });

  it('toont alleen de laatste 7 dagen en ruimt oudere notities op, zonder de tekst in het logboek', async () => {
    await db.query(`insert into public.handover_notes (group_id, body, created_at) values ('den_bosch', 'Oud', now() - interval '8 days')`);
    expect((await as(bas, () => db.query(`select body from public.handover_notes where body = 'Oud'`))).rows).toEqual([]);
    await as(eva, () => db.query(`insert into public.handover_notes (group_id, body) values ('eindhoven', 'Nieuw')`));
    expect((await db.query(`select body from public.handover_notes where body = 'Oud'`)).rows).toEqual([]);
    const log = await db.query<{ details: Record<string, unknown> }>(`select details from public.audit_log where entity = 'handover_notes'`);
    expect(JSON.stringify(log.rows)).not.toContain('Kluis');
    expect(JSON.stringify(log.rows)).not.toContain('Nieuw');
  });
});
