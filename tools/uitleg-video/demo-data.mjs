// Fictieve afwijkingen voor Sanne (fixture), zodat de video's ook afwezigheid, invallen en wijzigingen laten zien.
const SANNE = '20000000-0000-4000-8000-000000000002';
async function sql(text, params = []) {
  const response = await fetch('http://localhost:54321/mock/sql', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sql: text, params }) });
  const body = await response.json();
  if (!response.ok) throw new Error(`SQL: ${body.message}`);
  return body;
}
await sql(`delete from public.shift_overrides where employee_id = $1`, [SANNE]);
await sql(`delete from public.substitutions where employee_id = $1`, [SANNE]);
await sql(`delete from public.absences where employee_id = $1`, [SANNE]);
await sql(`delete from public.calendar_feeds where employee_id = $1`, [SANNE]);
await sql(`delete from public.push_subscriptions where employee_id = $1`, [SANNE]);
await sql(`insert into public.shift_overrides (employee_id, date, kind, group_id, role, start_time, end_time) values ($1, '2026-10-07', 'shift', 'eindhoven', 'counter', '07:30', '18:00')`, [SANNE]);
await sql(`insert into public.shift_overrides (employee_id, date, kind) values ($1, '2026-10-09', 'off')`, [SANNE]);
await sql(`insert into public.substitutions (employee_id, date, group_id, day_part) values ($1, '2026-10-10', 'breda', 'morning')`, [SANNE]);
await sql(`insert into public.absences (employee_id, start_date, end_date, day_part, status) values ($1, '2026-10-14', '2026-10-16', 'full_day', 'approved')`, [SANNE]);
await sql(`insert into public.absences (employee_id, start_date, end_date, day_part, status) values ($1, '2026-10-19', '2026-10-19', 'full_day', 'requested')`, [SANNE]);

// De uitleen (fase 5): twee auto's die Den Bosch vorige week uitleende (voor Opnieuw uitgeven), de
// auto die de werkplaats zaterdag meekreeg (die komt in de video terug) en een auto van Eindhoven.
const JORIS = '20000000-0000-4000-8000-000000000003';
const BRAM = '20000000-0000-4000-8000-000000000005';
await sql(`delete from public.vehicle_loans`);
await sql(
  `insert into public.vehicle_loans (group_id, license_plate, model, destination, handed_to, handed_out_by, handed_out_at, odometer_out,
     returned_at, returned_by, odometer_in, was_used) values
   ('den_bosch', 'GHP39K', 'Audi A4 Avant', 'mobility', 'Mobiliteit', $1, '2026-10-01 08:10+02', 45210, '2026-10-01 17:40+02', $1, 45388, true),
   ('den_bosch', 'X920RV', 'VW Polo', 'mobility', 'Mobiliteit', $2, '2026-10-02 08:05+02', 18730, '2026-10-02 16:55+02', $2, 18802, true),
   ('den_bosch', 'T826HN', 'VW Transporter', 'workshop_weekend', 'Werkplaats Den Bosch', $3, '2026-10-03 08:20+02', 102300, null, null, null, null),
   ('den_bosch', 'KPK66J', 'Skoda Octavia', 'mobility', 'Mobiliteit', $1, '2026-10-05 08:30+02', 60120, null, null, null, null)`,
  [JORIS, SANNE, BRAM],
);
console.log('demo-data ok');
