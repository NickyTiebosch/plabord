-- Planbord · fase 6 · 02 functies voor binnenvallers, dag afsluiten en doorbelasten

create or replace trigger audit after insert or update or delete on public.settings
  for each row execute function private.audit_row(
    'standard_shift_start', 'standard_shift_end', 'saturday_shift_start', 'saturday_shift_end',
    'day_part_boundary', 'lookahead_weeks', 'mail_enabled', 'charge_cancellation_from', 'day_close_reminder_at'
  );

-- Binnenvallers (V57): plus of min voor één werkplaats op één dag. Nooit onder 0. Iedere actieve
-- medewerker tot 7 dagen terug; ouder alleen beheerder of teamleider. Geeft het nieuwe aantal terug.
create or replace function public.adjust_walk_in(p_workshop_id uuid, p_date date, p_delta integer)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := private.current_employee_id();
  today date := (now() at time zone 'Europe/Amsterdam')::date;
  shop public.workshops%rowtype;
  result integer;
begin
  if me is null then
    raise exception 'Alleen een actieve medewerker kan binnenvallers bijwerken.' using errcode = '42501';
  end if;
  if p_delta is null or p_delta = 0 or abs(p_delta) > 50 then
    raise exception 'Vul een aantal in van 1 tot en met 50.' using errcode = '22023';
  end if;
  if p_date is null or p_date > today then
    raise exception 'Een dag in de toekomst kan niet.' using errcode = '22023';
  end if;
  if p_date < today - 7 and not private.is_lead() then
    raise exception 'Ouder dan een week: vraag het je teamleider.' using errcode = '42501';
  end if;
  select * into shop from public.workshops where id = p_workshop_id;
  if not found then
    raise exception 'Deze werkplaats bestaat niet meer.' using errcode = '22023';
  end if;
  insert into public.walk_ins as w (group_id, workshop_id, date, count, updated_by, updated_at)
  values (shop.group_id, shop.id, p_date, greatest(p_delta, 0), me, now())
  on conflict (workshop_id, date) do update
    set count = least(greatest(w.count + p_delta, 0), 500), updated_by = me, updated_at = now()
  returning count into result;
  return result;
end;
$$;
revoke all on function public.adjust_walk_in(uuid, date, integer) from public, anon, authenticated;
grant execute on function public.adjust_walk_in(uuid, date, integer) to authenticated;

-- Dag afsluiten (V60). Iedere actieve medewerker, voor vandaag of een eerdere dag. Een dag die al is
-- afgesloten blijft zo; het vinkje RentLink kan er nog bij. Geeft true terug als de dag nu pas is afgesloten.
create or replace function public.close_day(p_group_id text, p_date date, p_rentlink_checked boolean)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := private.current_employee_id();
  today date := (now() at time zone 'Europe/Amsterdam')::date;
  existed boolean;
begin
  if me is null then
    raise exception 'Alleen een actieve medewerker kan de dag afsluiten.' using errcode = '42501';
  end if;
  if p_date is null or p_date > today then
    raise exception 'Een dag in de toekomst kan niet.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.groups g where g.id = p_group_id and g.has_counter) then
    raise exception 'Kies een vestiging met een balie.' using errcode = '22023';
  end if;
  select exists (select 1 from public.day_closures where group_id = p_group_id and date = p_date) into existed;
  insert into public.day_closures as d (group_id, date, rentlink_checked, closed_by, closed_at)
  values (p_group_id, p_date, coalesce(p_rentlink_checked, false), me, now())
  on conflict (group_id, date) do update
    set rentlink_checked = d.rentlink_checked or excluded.rentlink_checked;
  return not existed;
end;
$$;
revoke all on function public.close_day(text, date, boolean) from public, anon, authenticated;
grant execute on function public.close_day(text, date, boolean) to authenticated;

-- Heropenen: alleen beheerder of teamleider.
create or replace function public.reopen_day(p_group_id text, p_date date)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  affected integer;
begin
  if not private.is_lead() then
    raise exception 'Alleen een beheerder of teamleider kan een dag heropenen.' using errcode = '42501';
  end if;
  delete from public.day_closures where group_id = p_group_id and date = p_date;
  get diagnostics affected = row_count;
  return affected;
end;
$$;
revoke all on function public.reopen_day(text, date) from public, anon, authenticated;
grant execute on function public.reopen_day(text, date) to authenticated;

-- Doorbelast ja of nee (V62): alleen beheerder of teamleider, alleen bij een melding die doorbelast moet worden.
create or replace function public.set_incident_charged(p_id uuid, p_charged boolean)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  affected integer;
begin
  if not private.is_lead() then
    raise exception 'Alleen een beheerder of teamleider kan dit omzetten.' using errcode = '42501';
  end if;
  update public.incident_reports
     set charged_at = case when p_charged then now() else null end,
         charged_by = case when p_charged then private.current_employee_id() else null end
   where id = p_id and charge is true and (charged_at is not null) is distinct from coalesce(p_charged, false);
  get diagnostics affected = row_count;
  return affected;
end;
$$;
revoke all on function public.set_incident_charged(uuid, boolean) from public, anon, authenticated;
grant execute on function public.set_incident_charged(uuid, boolean) to authenticated;

-- Mobiliteit (V59): wie een auto aanmeldde, kan die registratie op dezelfde dag zelf corrigeren of
-- verwijderen. Daarna en bij een registratie van een ander: beheerder of teamleider.
create or replace function private.owns_loan_today(p_handed_out_by uuid, p_created_at timestamptz)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_handed_out_by is not null
     and p_handed_out_by = private.current_employee_id()
     and (p_created_at at time zone 'Europe/Amsterdam')::date = (now() at time zone 'Europe/Amsterdam')::date
$$;
revoke all on function private.owns_loan_today(uuid, timestamptz) from public, anon, authenticated;
grant execute on function private.owns_loan_today(uuid, timestamptz) to authenticated, service_role;
drop policy if exists vehicle_loans_update on public.vehicle_loans;
create policy vehicle_loans_update on public.vehicle_loans for update to authenticated
  using ((select private.is_lead()) or private.owns_loan_today(handed_out_by, created_at))
  with check ((select private.is_lead()) or private.owns_loan_today(handed_out_by, created_at));
drop policy if exists vehicle_loans_delete on public.vehicle_loans;
create policy vehicle_loans_delete on public.vehicle_loans for delete to authenticated
  using ((select private.is_lead()) or private.owns_loan_today(handed_out_by, created_at));

-- De export van binnenvallers en meldingen in het logboek: beheerder of teamleider.
create or replace function public.log_export(p_kind text, p_employee_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  actor_employee uuid;
begin
  if p_kind is null or p_kind not in ('planning', 'employee', 'loans', 'walk_ins', 'incidents') then
    raise exception 'Onbekende export.' using errcode = '22023';
  end if;
  if p_kind in ('loans', 'walk_ins', 'incidents') then
    if not private.is_lead() then
      raise exception 'Alleen een beheerder of teamleider kan dit exporteren.' using errcode = '42501';
    end if;
  elsif not private.is_admin() then
    raise exception 'Alleen een beheerder kan exporteren.' using errcode = '42501';
  end if;
  if p_kind = 'employee' and p_employee_id is null then
    raise exception 'Kies een medewerker voor deze export.' using errcode = '22023';
  end if;
  select a.employee_id into actor_employee from public.employee_accounts a where a.user_id = actor;
  insert into public.audit_log (actor_user_id, actor_employee_id, action, entity, employee_id, details)
  values (
    actor, actor_employee, 'insert', 'export',
    case when p_kind = 'employee' then p_employee_id end,
    jsonb_build_object('kind', p_kind)
  );
end;
$$;
revoke all on function public.log_export(text, uuid) from public, anon, authenticated;
grant execute on function public.log_export(text, uuid) to authenticated;

-- De historie uit de oude Excel-bestanden inlezen (V63): alleen de beheerder. Binnenvallers: het
-- aantal uit het bestand vervangt wat er staat. Meldingen: een regel die al is ingelezen (zelfde
-- import_key) wordt overgeslagen. Geeft terug hoeveel er is ingelezen.
create or replace function public.import_registrations(plan jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := private.current_employee_id();
  previous text := current_setting('app.audit_source', true);
  walk_in_count integer := 0;
  incident_count integer := 0;
begin
  if not private.is_admin() then
    raise exception 'Alleen een beheerder kan de historie inlezen.' using errcode = '42501';
  end if;
  perform set_config('app.audit_source', 'import', true);

  with rows as (
    select (r ->> 'workshop_id')::uuid as workshop_id, (r ->> 'date')::date as date, (r ->> 'count')::integer as count
    from jsonb_array_elements(coalesce(plan -> 'walk_ins', '[]'::jsonb)) as r
  ), saved as (
    insert into public.walk_ins as w (group_id, workshop_id, date, count, updated_by, updated_at)
    select s.group_id, s.id, rows.date, rows.count, me, now()
    from rows join public.workshops s on s.id = rows.workshop_id
    on conflict (workshop_id, date) do update set count = excluded.count, updated_by = me, updated_at = now()
      where w.count is distinct from excluded.count
    returning 1
  )
  select count(*) into walk_in_count from saved;

  with rows as (
    select r from jsonb_array_elements(coalesce(plan -> 'incidents', '[]'::jsonb)) as r
  ), saved as (
    insert into public.incident_reports (
      group_id, workshop_id, occurred_at, kind, missing, cancelled_at, charge, license_plate, contract_number, note,
      reported_by, import_key
    )
    select s.group_id, s.id, (r ->> 'occurred_at')::timestamptz, r ->> 'kind', r ->> 'missing', (r ->> 'cancelled_at')::time,
           (r ->> 'charge')::boolean, r ->> 'license_plate', r ->> 'contract_number', r ->> 'note',
           (select e.id from public.employees e where e.id = (r ->> 'reported_by')::uuid), r ->> 'import_key'
    from rows join public.workshops s on s.id = (r ->> 'workshop_id')::uuid
    where r ->> 'import_key' is not null
    on conflict (import_key) do nothing
    returning 1
  )
  select count(*) into incident_count from saved;

  perform set_config('app.audit_source', coalesce(previous, ''), true);
  return jsonb_build_object('walk_ins', walk_in_count, 'incidents', incident_count);
end;
$$;
revoke all on function public.import_registrations(jsonb) from public, anon, authenticated;
grant execute on function public.import_registrations(jsonb) to authenticated;
