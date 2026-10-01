-- Planbord · fase 1 · 07 functies die de app aanroept

-- Koppelt het inlogaccount van de huidige gebruiker aan de medewerker met hetzelfde e-mailadres.
-- Het adres komt uit de sessie van Supabase Auth, dus is geverifieerd met de inlogcode.
-- Gebruikt voor de eerste beheerder en als het koppelen bij het aanmaken ooit misging.
create or replace function public.claim_account()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  caller_email text := lower(nullif(auth.jwt() ->> 'email', ''));
  linked uuid;
begin
  if caller is null or caller_email is null then
    return null;
  end if;

  select employee_id into linked from public.employee_accounts where user_id = caller;
  if linked is not null then
    return linked;
  end if;

  update public.employee_accounts
     set user_id = caller
   where email = caller_email
     and user_id is null
  returning employee_id into linked;
  return linked;
end;
$$;
revoke all on function public.claim_account() from public, anon, authenticated;
grant execute on function public.claim_account() to authenticated;

-- Voert een Excel-import uit in één transactie. security invoker: de gewone rechten (RLS)
-- gelden, dus alleen een beheerder kan dit. Het plan is vooraf gecontroleerd door de app.
create or replace function public.apply_import(plan jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  item jsonb;
  employee_ids jsonb := '{}'::jsonb;
  target uuid;
  owner uuid;
  affected integer;
  employees_created integer := 0;
  employees_updated integer := 0;
  accounts_created integer := 0;
  shifts_created integer := 0;
  shifts_updated integer := 0;
  shifts_closed integer := 0;
  absences_created integer := 0;
  absences_updated integer := 0;
begin
  if not private.is_admin() then
    raise exception 'Alleen een beheerder kan importeren.' using errcode = '42501';
  end if;
  perform set_config('app.audit_source', 'import', true);

  for item in select value from jsonb_array_elements(coalesce(plan -> 'employees', '[]'::jsonb)) loop
    target := nullif(item ->> 'id', '')::uuid;
    if target is null then
      insert into public.employees (name, group_id, default_role, is_admin)
      values (item ->> 'name', item ->> 'group_id', item ->> 'default_role', coalesce((item ->> 'is_admin')::boolean, false))
      returning id into target;
      employees_created := employees_created + 1;
    elsif coalesce((item ->> 'update')::boolean, false) then
      update public.employees
         set name = item ->> 'name',
             group_id = item ->> 'group_id',
             default_role = item ->> 'default_role',
             is_admin = coalesce((item ->> 'is_admin')::boolean, is_admin)
       where id = target;
      get diagnostics affected = row_count;
      if affected = 0 then
        raise exception 'Medewerker % bestaat niet meer. Laad de import opnieuw.', target;
      end if;
      employees_updated := employees_updated + 1;
    end if;

    if nullif(item ->> 'email', '') is not null then
      insert into public.employee_accounts (employee_id, email)
      values (target, item ->> 'email')
      on conflict (employee_id) do nothing;
      get diagnostics affected = row_count;
      accounts_created := accounts_created + affected;
    end if;

    if item ? 'counter_group_ids' then
      delete from public.counter_eligibility ce
       where ce.employee_id = target
         and not (ce.group_id = any (array(select jsonb_array_elements_text(item -> 'counter_group_ids'))));
      insert into public.counter_eligibility (employee_id, group_id)
      select target, g from jsonb_array_elements_text(item -> 'counter_group_ids') as g
      on conflict do nothing;
    end if;

    employee_ids := employee_ids || jsonb_build_object(item ->> 'key', target);
  end loop;

  -- Eerst afsluiten en bijwerken, daarna pas nieuwe diensten: zo overlapt er nooit iets tussendoor.
  for item in select value from jsonb_array_elements(coalesce(plan -> 'shifts', '[]'::jsonb)) loop
    owner := (employee_ids ->> (item ->> 'employee_key'))::uuid;
    if owner is null then
      raise exception 'Onbekende medewerker in de vaste roosters.';
    end if;

    if nullif(item ->> 'close_shift_id', '') is not null then
      update public.recurring_shifts
         set valid_to = (item ->> 'close_valid_to')::date
       where id = (item ->> 'close_shift_id')::uuid and employee_id = owner;
      get diagnostics affected = row_count;
      shifts_closed := shifts_closed + affected;
    end if;

    if nullif(item ->> 'id', '') is not null then
      update public.recurring_shifts
         set group_id = item ->> 'group_id',
             role = item ->> 'role',
             start_time = (item ->> 'start_time')::time,
             end_time = (item ->> 'end_time')::time,
             valid_to = (item ->> 'valid_to')::date
       where id = (item ->> 'id')::uuid and employee_id = owner;
      get diagnostics affected = row_count;
      if affected = 0 then
        raise exception 'Een vaste dienst bestaat niet meer. Laad de import opnieuw.';
      end if;
      shifts_updated := shifts_updated + 1;
    end if;
  end loop;

  for item in select value from jsonb_array_elements(coalesce(plan -> 'shifts', '[]'::jsonb)) loop
    if nullif(item ->> 'id', '') is null then
      insert into public.recurring_shifts (employee_id, weekday, group_id, role, start_time, end_time, valid_from, valid_to)
      values (
        (employee_ids ->> (item ->> 'employee_key'))::uuid,
        (item ->> 'weekday')::smallint,
        item ->> 'group_id',
        item ->> 'role',
        (item ->> 'start_time')::time,
        (item ->> 'end_time')::time,
        (item ->> 'valid_from')::date,
        (item ->> 'valid_to')::date
      );
      shifts_created := shifts_created + 1;
    end if;
  end loop;

  for item in select value from jsonb_array_elements(coalesce(plan -> 'absences', '[]'::jsonb)) loop
    owner := (employee_ids ->> (item ->> 'employee_key'))::uuid;
    if owner is null then
      raise exception 'Onbekende medewerker in de afwezigheid.';
    end if;

    insert into public.absences (employee_id, start_date, end_date, day_part, status)
    values (
      owner,
      (item ->> 'start_date')::date,
      (item ->> 'end_date')::date,
      item ->> 'day_part',
      item ->> 'status'
    )
    on conflict (employee_id, start_date, end_date, day_part) do update
      set status = excluded.status
      where public.absences.status is distinct from excluded.status;
    get diagnostics affected = row_count;
    if nullif(item ->> 'id', '') is null then
      absences_created := absences_created + affected;
    else
      absences_updated := absences_updated + affected;
    end if;
  end loop;

  return jsonb_build_object(
    'employees_created', employees_created,
    'employees_updated', employees_updated,
    'accounts_created', accounts_created,
    'shifts_created', shifts_created,
    'shifts_updated', shifts_updated,
    'shifts_closed', shifts_closed,
    'absences_created', absences_created,
    'absences_updated', absences_updated,
    'employee_ids', employee_ids
  );
end;
$$;
revoke all on function public.apply_import(jsonb) from public, anon, authenticated;
grant execute on function public.apply_import(jsonb) to authenticated;
