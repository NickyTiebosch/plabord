-- Planbord · fase 3 · 03 volledig verwijderen en export in het logboek

-- Het logboek, zoals in fase 1, met één uitzondering: bij volledig verwijderen (besluit V21)
-- logt delete_employee zelf één regel met de aantallen. De rijen die daarbij via de cascade
-- verdwijnen, krijgen geen eigen regel: dat zou de gegevens van de verwijderde persoon
-- alsnog in het logboek bewaren.
create or replace function private.audit_row()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  old_row jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  new_row jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;
  row_data jsonb := coalesce(new_row, old_row);
  changed text[];
  detail jsonb;
  actor uuid := auth.uid();
  actor_employee uuid;
  subject uuid;
begin
  if nullif(current_setting('app.audit_source', true), '') = 'verwijderen' then
    return null;
  end if;

  if tg_op = 'UPDATE' then
    select coalesce(array_agg(n.key order by n.key), '{}')
      into changed
      from jsonb_each(new_row) as n(key, value)
     where n.key not in ('created_at', 'updated_at')
       and n.value is distinct from old_row -> n.key;
    -- Niets veranderd: niets loggen.
    if cardinality(changed) = 0 then
      return null;
    end if;
    select jsonb_object_agg(k, jsonb_build_object('old', old_row -> k, 'new', new_row -> k))
      into detail
      from unnest(changed) as k
     where k = any (tg_argv);
  else
    select jsonb_object_agg(k, row_data -> k)
      into detail
      from unnest(tg_argv) as k
     where row_data ? k;
  end if;

  if actor is not null then
    select a.employee_id into actor_employee from public.employee_accounts a where a.user_id = actor;
  end if;

  if tg_table_name = 'employees' then
    subject := (row_data ->> 'id')::uuid;
  elsif row_data ? 'employee_id' then
    subject := (row_data ->> 'employee_id')::uuid;
  end if;

  insert into public.audit_log (
    actor_user_id, actor_employee_id, action, entity, entity_id, employee_id, changed_fields, details, source
  ) values (
    actor, actor_employee, lower(tg_op), tg_table_name, row_data ->> 'id', subject, changed, detail,
    nullif(current_setting('app.audit_source', true), '')
  );

  delete from public.audit_log where occurred_at < now() - interval '12 months';
  return null;
end;
$$;
revoke all on function private.audit_row() from public, anon, authenticated;

-- Een medewerker volledig verwijderen (besluit V21). Het inlogaccount verwijdert de app vooraf
-- met de secret key. Alleen een beheerder, alleen bij een inactieve medewerker, en niet jezelf.
-- De rest verdwijnt via de bestaande `on delete cascade`. Geeft de aantallen terug.
create or replace function public.delete_employee(p_employee_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.employees%rowtype;
  actor uuid := auth.uid();
  actor_employee uuid;
  counts jsonb;
begin
  if not private.is_admin() then
    raise exception 'Alleen een beheerder kan een medewerker verwijderen.' using errcode = '42501';
  end if;
  select * into target from public.employees where id = p_employee_id for update;
  if not found then
    raise exception 'Deze medewerker bestaat niet meer.' using errcode = 'P0002';
  end if;
  select a.employee_id into actor_employee from public.employee_accounts a where a.user_id = actor;
  if actor_employee = p_employee_id then
    raise exception 'Je kunt jezelf niet verwijderen.' using errcode = 'P0001';
  end if;
  if target.is_active then
    raise exception 'Zet de medewerker eerst op inactief.' using errcode = 'P0001';
  end if;

  counts := jsonb_build_object(
    'recurring_shifts', (select count(*) from public.recurring_shifts where employee_id = p_employee_id),
    'absences', (select count(*) from public.absences where employee_id = p_employee_id),
    'substitutions', (select count(*) from public.substitutions where employee_id = p_employee_id),
    'shift_overrides', (select count(*) from public.shift_overrides where employee_id = p_employee_id),
    'calendar_feeds', (select count(*) from public.calendar_feeds where employee_id = p_employee_id),
    'account', exists (select 1 from public.employee_accounts where employee_id = p_employee_id)
  );

  perform set_config('app.audit_source', 'verwijderen', true);
  delete from public.employees where id = p_employee_id;
  insert into public.audit_log (
    actor_user_id, actor_employee_id, action, entity, entity_id, employee_id, details, source
  ) values (
    actor, actor_employee, 'delete', 'employees', p_employee_id::text, p_employee_id, counts, 'verwijderen'
  );
  perform set_config('app.audit_source', '', true);
  return counts;
end;
$$;
revoke all on function public.delete_employee(uuid) from public, anon, authenticated;
grant execute on function public.delete_employee(uuid) to authenticated;

-- Een export in het logboek (besluit V20): wie, wanneer en welke. 'planning' of 'employee'.
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
  if not private.is_admin() then
    raise exception 'Alleen een beheerder kan exporteren.' using errcode = '42501';
  end if;
  if p_kind is null or p_kind not in ('planning', 'employee') then
    raise exception 'Onbekende export.' using errcode = '22023';
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
