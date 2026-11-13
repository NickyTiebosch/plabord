-- =====================================================================
-- Planbord · testgegevens voor het testproject (besluit V42)
--
-- Alleen voor het Supabase-project "Planbord test". Nooit in het live project draaien.
-- Een verzonnen team zonder e-mailadressen en zonder inlogaccounts: niemand van dit team kan
-- inloggen. Jezelf voeg je daarna toe als beheerder, met de stappen in de README.
-- Draai eerst fase-1.sql tot en met fase-5.sql. Daarna kan dit bestand vaker draaien: wat er al
-- staat, blijft staan. Datums liggen rond vandaag.
-- =====================================================================

begin;

do $$
begin
  if (select count(*) from public.employee_accounts) > 5 then
    raise exception 'Dit lijkt het live project: er zijn al meer dan vijf werkmails. De testgegevens horen alleen in het testproject.';
  end if;
  perform set_config('app.audit_source', 'setup', true);
end;
$$;

insert into public.employees (id, name, group_id, default_role, is_admin, is_team_lead) values
  ('30000000-0000-4000-8000-000000000002', 'Sanne', 'den_bosch', 'counter', false, false),
  ('30000000-0000-4000-8000-000000000003', 'Joris', 'den_bosch', 'counter', false, false),
  ('30000000-0000-4000-8000-000000000004', 'Fleur', 'den_bosch', 'counter', false, false),
  ('30000000-0000-4000-8000-000000000005', 'Bram', 'den_bosch', 'counter', false, false),
  ('30000000-0000-4000-8000-000000000006', 'Ingrid', 'den_bosch', 'cleaning', false, false),
  ('30000000-0000-4000-8000-000000000007', 'Daan', 'eindhoven', 'counter', false, false),
  ('30000000-0000-4000-8000-000000000008', 'Lotte', 'eindhoven', 'counter', false, false),
  ('30000000-0000-4000-8000-000000000009', 'Milan', 'eindhoven', 'counter', false, false),
  ('30000000-0000-4000-8000-000000000010', 'Noor', 'eindhoven', 'cleaning', false, false),
  ('30000000-0000-4000-8000-000000000011', 'Zoë', 'eindhoven', 'counter', false, false),
  ('30000000-0000-4000-8000-000000000012', 'Eva', 'breda', 'counter', false, false),
  ('30000000-0000-4000-8000-000000000013', 'Thijs', 'breda', 'counter', false, false),
  ('30000000-0000-4000-8000-000000000014', 'Yara', 'breda', 'counter', false, false),
  ('30000000-0000-4000-8000-000000000015', 'Kees', 'breda', 'cleaning', false, false),
  ('30000000-0000-4000-8000-000000000016', 'Ruben', 'logistics', 'transport', false, false),
  ('30000000-0000-4000-8000-000000000017', 'Anouk', 'logistics', 'transport', false, false),
  ('30000000-0000-4000-8000-000000000018', 'Gert', 'logistics', 'transport', false, false),
  ('30000000-0000-4000-8000-000000000019', 'Danique', 'backoffice', 'backoffice', false, false),
  ('30000000-0000-4000-8000-000000000020', 'Petra', 'other', 'none', false, false),
  ('30000000-0000-4000-8000-000000000021', 'Hans', 'other', 'none', false, false),
  ('30000000-0000-4000-8000-000000000022', 'Iris', 'other', 'none', false, false),
  ('30000000-0000-4000-8000-000000000023', 'Tess', 'other', 'none', false, true)
on conflict do nothing;

insert into public.counter_eligibility (employee_id, group_id) values
  ('30000000-0000-4000-8000-000000000002', 'den_bosch'), ('30000000-0000-4000-8000-000000000002', 'eindhoven'),
  ('30000000-0000-4000-8000-000000000003', 'den_bosch'),
  ('30000000-0000-4000-8000-000000000004', 'den_bosch'),
  ('30000000-0000-4000-8000-000000000005', 'den_bosch'), ('30000000-0000-4000-8000-000000000005', 'breda'),
  ('30000000-0000-4000-8000-000000000007', 'eindhoven'), ('30000000-0000-4000-8000-000000000007', 'den_bosch'),
  ('30000000-0000-4000-8000-000000000008', 'eindhoven'),
  ('30000000-0000-4000-8000-000000000009', 'eindhoven'),
  ('30000000-0000-4000-8000-000000000011', 'eindhoven'),
  ('30000000-0000-4000-8000-000000000012', 'breda'),
  ('30000000-0000-4000-8000-000000000013', 'breda'), ('30000000-0000-4000-8000-000000000013', 'eindhoven'),
  ('30000000-0000-4000-8000-000000000014', 'breda'),
  ('30000000-0000-4000-8000-000000000017', 'den_bosch'),
  ('30000000-0000-4000-8000-000000000019', 'den_bosch'), ('30000000-0000-4000-8000-000000000019', 'eindhoven'),
  ('30000000-0000-4000-8000-000000000019', 'breda'),
  ('30000000-0000-4000-8000-000000000020', 'den_bosch'),
  ('30000000-0000-4000-8000-000000000021', 'eindhoven'),
  ('30000000-0000-4000-8000-000000000022', 'breda')
on conflict do nothing;

-- Vaste diensten vanaf 1 januari 2026: (medewerker, groep, rol, dagen, begin, eind).
insert into public.recurring_shifts (employee_id, weekday, group_id, role, start_time, end_time, valid_from)
select ('30000000-0000-4000-8000-0000000000' || lpad(e.n::text, 2, '0'))::uuid, d, e.g, e.r, e.st, e.et, date '2026-01-01'
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
  (20, 'other', 'none', array[1,2,3,4,5], null, null),
  (21, 'other', 'none', array[1,2,3,4], null, null),
  (22, 'other', 'none', array[2,3,4,5], null, null),
  (23, 'other', 'none', array[1,2,3,4,5], null, null)
) as e(n, g, r, days, st, et)
cross join lateral unnest(e.days) as d
on conflict do nothing;

-- Afwezigheid rond vandaag: een gat in Eindhoven volgende week, een aanvraag in Breda, en Joris deze week.
insert into public.absences (id, employee_id, start_date, end_date, day_part, status) values
  ('31000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000008', current_date + 7, current_date + 7, 'full_day', 'approved'),
  ('31000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000012', current_date + 8, current_date + 8, 'morning', 'requested'),
  ('31000000-0000-4000-8000-000000000003', '30000000-0000-4000-8000-000000000003', current_date, current_date + 4, 'full_day', 'approved')
on conflict do nothing;

-- Uitleen: twee auto's uit (één al te lang), en twee retour (ingezet en niet ingezet).
insert into public.vehicle_loans (
  id, group_id, license_plate, model, destination, handed_to, handed_out_by, handed_out_at, odometer_out,
  returned_at, returned_by, odometer_in, was_used, note, return_note
) values
  ('32000000-0000-4000-8000-000000000001', 'den_bosch', 'GHP39K', 'Audi A4 Avant', 'mobility', 'Mobiliteit',
   '30000000-0000-4000-8000-000000000002', now() - interval '2 hours', 45210, null, null, null, null, null, null),
  ('32000000-0000-4000-8000-000000000002', 'den_bosch', 'X920RV', 'VW Polo', 'mobility', 'Mobiliteit',
   '30000000-0000-4000-8000-000000000003', now() - interval '4 days', 18730, null, null, null, null, null, null),
  ('32000000-0000-4000-8000-000000000003', 'den_bosch', 'KPK66J', 'Skoda Octavia', 'workshop_weekend', 'Werkplaats Den Bosch',
   '30000000-0000-4000-8000-000000000005', now() - interval '5 days', 60120,
   now() - interval '3 days', '30000000-0000-4000-8000-000000000002', 60188, true, 'Voor spoedjes op zaterdag', null),
  ('32000000-0000-4000-8000-000000000004', 'den_bosch', 'T826HN', 'VW Transporter', 'mobility', 'Mobiliteit',
   '30000000-0000-4000-8000-000000000005', now() - interval '1 day', 102300,
   now() - interval '20 hours', '30000000-0000-4000-8000-000000000005', null, false, null, 'Niet ingezet')
on conflict do nothing;

-- Sinds besluit V52 leent alleen Den Bosch uit. Een eerdere versie van dit bestand zette twee auto's
-- bij Eindhoven en Breda; die verhuizen naar Den Bosch.
update public.vehicle_loans
   set group_id = 'den_bosch',
       handed_to = case when destination = 'workshop_weekend' then 'Werkplaats Den Bosch' else handed_to end
 where id in ('32000000-0000-4000-8000-000000000002', '32000000-0000-4000-8000-000000000003')
   and group_id <> 'den_bosch';

commit;
