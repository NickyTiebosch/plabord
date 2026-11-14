-- =====================================================================
-- Planbord · testgegevens voor het testproject (besluit V42)
--
-- Alleen voor het Supabase-project "Planbord test". Nooit in het live project draaien.
-- Een verzonnen team zonder e-mailadressen en zonder inlogaccounts: niemand van dit team kan
-- inloggen. Jezelf voeg je daarna toe als beheerder, met de stappen in de README.
-- Draai eerst fase-1.sql tot en met de nieuwste fase. Daarna kan dit bestand vaker draaien: wat er al
-- staat, blijft staan. Datums liggen rond vandaag. Onderdelen van een fase die nog niet is gedraaid,
-- worden overgeslagen.
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
  ('32000000-0000-4000-8000-000000000002', 'eindhoven', 'X920RV', 'VW Polo', 'mobility', 'Mobiliteit',
   '30000000-0000-4000-8000-000000000007', now() - interval '4 days', 18730, null, null, null, null, null, null),
  ('32000000-0000-4000-8000-000000000003', 'breda', 'KPK66J', 'Skoda Octavia', 'workshop_weekend', 'Werkplaats Breda',
   '30000000-0000-4000-8000-000000000012', now() - interval '5 days', 60120,
   now() - interval '3 days', '30000000-0000-4000-8000-000000000013', 60188, true, 'Voor spoedjes op zaterdag', null),
  ('32000000-0000-4000-8000-000000000004', 'den_bosch', 'T826HN', 'VW Transporter', 'mobility', 'Mobiliteit',
   '30000000-0000-4000-8000-000000000005', now() - interval '1 day', 102300,
   now() - interval '20 hours', '30000000-0000-4000-8000-000000000005', null, false, null, 'Niet ingezet')
on conflict do nothing;

-- Fase 6: binnenvallers en afgesloten dagen voor de afgelopen twee weken, en een paar meldingen.
-- Eindhoven sloot twee dagen niet af, zodat de invulcontrole rood laat zien.
do $$
begin
  if to_regclass('public.walk_ins') is null then
    return;
  end if;
  perform set_config('app.audit_source', 'setup', true);

  insert into public.walk_ins (group_id, workshop_id, date, count)
  select w.group_id, w.id, d::date, abs(hashtext(w.name || d::date::text)) % 5
  from public.workshops w
  cross join generate_series(current_date - 14, current_date - 1, interval '1 day') as d
  where extract(isodow from d) < 6 and w.is_active
  on conflict do nothing;

  insert into public.day_closures (group_id, date, rentlink_checked, closed_by)
  select g.id, d::date, true,
         case g.id when 'den_bosch' then '30000000-0000-4000-8000-000000000002'::uuid
                   when 'eindhoven' then '30000000-0000-4000-8000-000000000007'::uuid
                   else '30000000-0000-4000-8000-000000000012'::uuid end
  from public.groups g
  cross join generate_series(current_date - 14, current_date - 1, interval '1 day') as d
  where g.has_counter and extract(isodow from d) < 6
    and not (g.id = 'eindhoven' and d::date in (current_date - 3, current_date - 4))
  on conflict do nothing;

  insert into public.incident_reports (
    id, group_id, workshop_id, occurred_at, kind, missing, cancelled_at, charge, license_plate, contract_number, note, reported_by
  )
  select v.id, w.group_id, w.id, v.at, v.kind, v.missing, v.cancelled, v.charge, v.plate, v.contract, v.note, v.who
  from (values
    ('33000000-0000-4000-8000-000000000001'::uuid, 'den_bosch', 'Audi', now() - interval '2 days', 'cancellation', null, '11:40'::time, true,
     'JTX38S', '681613', 'Klant niet gekomen', '30000000-0000-4000-8000-000000000002'::uuid),
    ('33000000-0000-4000-8000-000000000002'::uuid, 'den_bosch', 'Oss', now() - interval '3 days', 'contract_license', 'both', null, null,
     'GJR46F', '688116', null, '30000000-0000-4000-8000-000000000003'::uuid),
    ('33000000-0000-4000-8000-000000000003'::uuid, 'eindhoven', 'Veldhoven', now() - interval '20 days', 'cancellation', null, '12:04'::time, true,
     'GRH31P', '683319', null, '30000000-0000-4000-8000-000000000007'::uuid),
    ('33000000-0000-4000-8000-000000000004'::uuid, 'breda', 'Halsteren', now() - interval '1 day', 'cancellation', null, '07:51'::time, false,
     'HJH61F', '681577', 'Op tijd doorgegeven', '30000000-0000-4000-8000-000000000012'::uuid),
    ('33000000-0000-4000-8000-000000000005'::uuid, 'breda', 'Volkswagen', now() - interval '4 days', 'wrong_vehicle', null, null, null,
     'X221LB', '688082', null, '30000000-0000-4000-8000-000000000013'::uuid)
  ) as v(id, group_id, workshop, at, kind, missing, cancelled, charge, plate, contract, note, who)
  join public.workshops w on w.group_id = v.group_id and w.name = v.workshop
  on conflict do nothing;
end;
$$;

commit;
