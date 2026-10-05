-- Fictief team voor de nagebootste Supabase (uitlegvideo's en lokale tests). Zelfde opbouw als de
-- fixture in src/lib/engine/__fixtures__/team.ts. Geen echte namen of adressen.
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000a001', 'anna@voorbeeld.nl'),
  ('00000000-0000-0000-0000-00000000a002', 'sanne@voorbeeld.nl'),
  ('00000000-0000-0000-0000-00000000a003', 'danique@voorbeeld.nl'),
  ('00000000-0000-0000-0000-00000000a004', 'joris@voorbeeld.nl');

insert into public.employees (id, name, group_id, default_role, is_admin) values
  ('20000000-0000-4000-8000-000000000001', 'Anna', 'other', 'none', true),
  ('20000000-0000-4000-8000-000000000002', 'Sanne', 'den_bosch', 'counter', false),
  ('20000000-0000-4000-8000-000000000003', 'Joris', 'den_bosch', 'counter', false),
  ('20000000-0000-4000-8000-000000000004', 'Fleur', 'den_bosch', 'counter', false),
  ('20000000-0000-4000-8000-000000000005', 'Bram', 'den_bosch', 'counter', false),
  ('20000000-0000-4000-8000-000000000006', 'Ingrid', 'den_bosch', 'cleaning', false),
  ('20000000-0000-4000-8000-000000000007', 'Daan', 'eindhoven', 'counter', false),
  ('20000000-0000-4000-8000-000000000008', 'Lotte', 'eindhoven', 'counter', false),
  ('20000000-0000-4000-8000-000000000009', 'Milan', 'eindhoven', 'counter', false),
  ('20000000-0000-4000-8000-000000000010', 'Noor', 'eindhoven', 'cleaning', false),
  ('20000000-0000-4000-8000-000000000011', 'Zoë', 'eindhoven', 'counter', false),
  ('20000000-0000-4000-8000-000000000012', 'Eva', 'breda', 'counter', false),
  ('20000000-0000-4000-8000-000000000013', 'Thijs', 'breda', 'counter', false),
  ('20000000-0000-4000-8000-000000000014', 'Yara', 'breda', 'counter', false),
  ('20000000-0000-4000-8000-000000000015', 'Kees', 'breda', 'cleaning', false),
  ('20000000-0000-4000-8000-000000000016', 'Ruben', 'logistics', 'transport', false),
  ('20000000-0000-4000-8000-000000000017', 'Anouk', 'logistics', 'transport', false),
  ('20000000-0000-4000-8000-000000000018', 'Gert', 'logistics', 'transport', false),
  ('20000000-0000-4000-8000-000000000019', 'Danique', 'backoffice', 'backoffice', false),
  ('20000000-0000-4000-8000-000000000020', 'Petra', 'other', 'none', false),
  ('20000000-0000-4000-8000-000000000021', 'Hans', 'other', 'none', false),
  ('20000000-0000-4000-8000-000000000022', 'Iris', 'other', 'none', false),
  ('20000000-0000-4000-8000-000000000023', 'Wouter', 'other', 'none', false);

insert into public.employee_accounts (employee_id, email, user_id) values
  ('20000000-0000-4000-8000-000000000001', 'anna@voorbeeld.nl', '00000000-0000-0000-0000-00000000a001'),
  ('20000000-0000-4000-8000-000000000002', 'sanne@voorbeeld.nl', '00000000-0000-0000-0000-00000000a002'),
  ('20000000-0000-4000-8000-000000000019', 'danique@voorbeeld.nl', '00000000-0000-0000-0000-00000000a003'),
  ('20000000-0000-4000-8000-000000000003', 'joris@voorbeeld.nl', '00000000-0000-0000-0000-00000000a004');

insert into public.counter_eligibility (employee_id, group_id) values
  ('20000000-0000-4000-8000-000000000002', 'den_bosch'), ('20000000-0000-4000-8000-000000000002', 'eindhoven'),
  ('20000000-0000-4000-8000-000000000003', 'den_bosch'),
  ('20000000-0000-4000-8000-000000000004', 'den_bosch'),
  ('20000000-0000-4000-8000-000000000005', 'den_bosch'), ('20000000-0000-4000-8000-000000000005', 'breda'),
  ('20000000-0000-4000-8000-000000000007', 'eindhoven'), ('20000000-0000-4000-8000-000000000007', 'den_bosch'),
  ('20000000-0000-4000-8000-000000000008', 'eindhoven'),
  ('20000000-0000-4000-8000-000000000009', 'eindhoven'),
  ('20000000-0000-4000-8000-000000000011', 'eindhoven'),
  ('20000000-0000-4000-8000-000000000012', 'breda'),
  ('20000000-0000-4000-8000-000000000013', 'breda'), ('20000000-0000-4000-8000-000000000013', 'eindhoven'),
  ('20000000-0000-4000-8000-000000000014', 'breda'),
  ('20000000-0000-4000-8000-000000000017', 'den_bosch'),
  ('20000000-0000-4000-8000-000000000019', 'den_bosch'), ('20000000-0000-4000-8000-000000000019', 'eindhoven'),
  ('20000000-0000-4000-8000-000000000019', 'breda'),
  ('20000000-0000-4000-8000-000000000020', 'den_bosch'),
  ('20000000-0000-4000-8000-000000000021', 'eindhoven'),
  ('20000000-0000-4000-8000-000000000022', 'breda');

-- Vaste diensten: (medewerker, groep, rol, dagen, begin, eind)
insert into public.recurring_shifts (employee_id, weekday, group_id, role, start_time, end_time, valid_from)
select ('20000000-0000-4000-8000-0000000000' || lpad(e.n::text, 2, '0'))::uuid, d, e.g, e.r, e.st, e.et, date '2026-01-01'
from (values
  (2, 'den_bosch', 'counter', array[1,2,3,4,5], null::time, null::time),
  (3, 'den_bosch', 'counter', array[1,2,3], null, null),
  (4, 'den_bosch', 'counter', array[3,4,5], null, null),
  (5, 'den_bosch', 'counter', array[1,2,3,4,5], null, null),
  (6, 'den_bosch', 'cleaning', array[1,3,5], '07:30', '11:30'),
  (7, 'eindhoven', 'counter', array[1,2,3,4,5], null, null),
  (8, 'eindhoven', 'counter', array[1,2,3,4], null, null),
  (9, 'eindhoven', 'counter', array[2,3,4,5], null, null),
  (10, 'eindhoven', 'cleaning', array[2,4], '16:00', '18:00'),
  (11, 'eindhoven', 'counter', array[6], '09:00', '13:00'),
  (12, 'breda', 'counter', array[1,2,3,4,5], null, null),
  (13, 'breda', 'counter', array[1,2,3,4,5], null, null),
  (14, 'breda', 'counter', array[1,3,5], null, null),
  (15, 'breda', 'cleaning', array[1,2,3,4,5], '07:30', '11:30'),
  (16, 'logistics', 'transport', array[1,2,3,4,5], null, null),
  (17, 'den_bosch', 'counter', array[2,4], null, null),
  (17, 'logistics', 'transport', array[3,5], null, null),
  (19, 'backoffice', 'backoffice', array[1,2,3,4,5], null, null),
  (1, 'other', 'none', array[1,2,3,4,5], null, null),
  (20, 'other', 'none', array[1,2,3,4,5], null, null),
  (21, 'other', 'none', array[1,2,3,4], null, null),
  (22, 'other', 'none', array[2,3,4,5], null, null),
  (23, 'other', 'none', array[1,3,5], null, null)
) as e(n, g, r, days, st, et)
cross join lateral unnest(e.days) as d;

-- Afwezigheid: Lotte maandag 12 okt (gat in Eindhoven), Eva dinsdagochtend 13 okt (gat in Breda).
insert into public.absences (employee_id, start_date, end_date, day_part, status) values
  ('20000000-0000-4000-8000-000000000008', '2026-10-12', '2026-10-12', 'full_day', 'approved'),
  ('20000000-0000-4000-8000-000000000012', '2026-10-13', '2026-10-13', 'morning', 'requested'),
  ('20000000-0000-4000-8000-000000000003', '2026-10-05', '2026-10-09', 'full_day', 'approved');

-- Fase 3: werkmail en account voor Bram, Zoë en Gert (fictief), zodat mails, herinneringen en verwijderen te testen zijn.
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000a005', 'bram@voorbeeld.nl'),
  ('00000000-0000-0000-0000-00000000a006', 'zoe@voorbeeld.nl'),
  ('00000000-0000-0000-0000-00000000a007', 'gert@voorbeeld.nl');
insert into public.employee_accounts (employee_id, email, user_id) values
  ('20000000-0000-4000-8000-000000000005', 'bram@voorbeeld.nl', '00000000-0000-0000-0000-00000000a005'),
  ('20000000-0000-4000-8000-000000000011', 'zoe@voorbeeld.nl', '00000000-0000-0000-0000-00000000a006'),
  ('20000000-0000-4000-8000-000000000018', 'gert@voorbeeld.nl', '00000000-0000-0000-0000-00000000a007');
