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
console.log('demo-data ok');
