-- Planbord · fase 1 · 06 logboek
-- Wie, wat, wanneer. Zonder gevoelige inhoud: geen e-mailadressen, namen of tokens.
-- Alleen velden uit de lijst per tabel worden met waarde gelogd; van de rest alleen de naam.
-- Alleen zichtbaar voor beheerders. Regels ouder dan 12 maanden worden automatisch verwijderd.

create table if not exists public.audit_log (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),
  -- Leeg = het systeem (setup of de server).
  actor_user_id uuid,
  actor_employee_id uuid,
  action text not null,
  entity text not null,
  entity_id text,
  -- De medewerker om wie het gaat, als dat van toepassing is.
  employee_id uuid,
  changed_fields text[],
  details jsonb,
  -- Bijvoorbeeld 'import' of 'setup'.
  source text,
  constraint audit_log_action check (action in ('insert', 'update', 'delete'))
);
create index if not exists audit_log_occurred_at_idx on public.audit_log (occurred_at desc);
create index if not exists audit_log_employee_idx on public.audit_log (employee_id, occurred_at desc);

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

-- Per tabel de velden die met waarde gelogd mogen worden.
create or replace trigger audit after insert or update or delete on public.groups
  for each row execute function private.audit_row('name', 'has_counter', 'sort_order', 'substitution_rank');
create or replace trigger audit after insert or update or delete on public.settings
  for each row execute function private.audit_row(
    'standard_shift_start', 'standard_shift_end', 'saturday_shift_start', 'saturday_shift_end',
    'day_part_boundary', 'lookahead_weeks'
  );
create or replace trigger audit after insert or update or delete on public.staffing_norms
  for each row execute function private.audit_row('group_id', 'weekday', 'day_part', 'min_staff');
create or replace trigger audit after insert or update or delete on public.employees
  for each row execute function private.audit_row('group_id', 'default_role', 'is_admin', 'is_active');
-- Werkmail: alleen dat er iets veranderde, nooit het adres zelf.
create or replace trigger audit after insert or update or delete on public.employee_accounts
  for each row execute function private.audit_row();
create or replace trigger audit after insert or update or delete on public.counter_eligibility
  for each row execute function private.audit_row('group_id');
create or replace trigger audit after insert or update or delete on public.recurring_shifts
  for each row execute function private.audit_row(
    'weekday', 'group_id', 'role', 'start_time', 'end_time', 'valid_from', 'valid_to'
  );
create or replace trigger audit after insert or update or delete on public.absences
  for each row execute function private.audit_row('start_date', 'end_date', 'day_part', 'status');
create or replace trigger audit after insert or update or delete on public.closure_days
  for each row execute function private.audit_row('date', 'group_id', 'is_closed', 'label');
-- Agendalinks: nooit de hash.
create or replace trigger audit after insert or update or delete on public.calendar_feeds
  for each row execute function private.audit_row('kind', 'group_id', 'revoked_at');

alter table public.audit_log enable row level security;
revoke all on table public.audit_log from anon, authenticated;
grant select on table public.audit_log to authenticated;
grant all on table public.audit_log to service_role;
drop policy if exists audit_log_select on public.audit_log;
create policy audit_log_select on public.audit_log for select to authenticated
  using ((select private.is_admin()));
