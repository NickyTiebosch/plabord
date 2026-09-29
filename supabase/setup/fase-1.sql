-- =====================================================================
-- Planbord · Fase 1: vervangt de Excel
--
-- Plak dit hele bestand in Supabase: SQL Editor → New query → Run.
-- Het is veilig om opnieuw te draaien: bestaande tabellen en gegevens blijven staan.
--
-- Gegenereerd met `npm run db:bundle` uit supabase/migrations. Niet met de hand aanpassen.
-- =====================================================================

begin;
-- ---------------------------------------------------------------------
-- 20261001000100_foundation.sql
-- ---------------------------------------------------------------------

-- Planbord · fase 1 · 01 basis
-- Extensies, schema private, updated_at-trigger, groepen, instellingen en normen.

create schema if not exists extensions;
create extension if not exists btree_gist with schema extensions;

-- Hulpfuncties staan in een eigen schema dat niet via de API bereikbaar is.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function private.set_updated_at() from public, anon, authenticated;

-- Groepen: de drie vestigingen met een balie en de ondersteunende groepen.
create table if not exists public.groups (
  id text primary key,
  name text not null,
  has_counter boolean not null default false,
  sort_order smallint not null default 0,
  substitution_rank smallint not null default 1,
  updated_at timestamptz not null default now(),
  constraint groups_id_format check (id ~ '^[a-z][a-z_]*$'),
  constraint groups_name_format check (name = btrim(name) and char_length(name) between 1 and 40),
  constraint groups_substitution_rank_range check (substitution_rank between 1 and 99),
  constraint groups_id_has_counter_key unique (id, has_counter)
);
create or replace trigger set_updated_at before update on public.groups
  for each row execute function private.set_updated_at();

-- Instellingen: precies één rij.
create table if not exists public.settings (
  id boolean primary key default true,
  standard_shift_start time not null default '07:30',
  standard_shift_end time not null default '18:00',
  saturday_shift_start time not null default '07:30',
  saturday_shift_end time not null default '18:00',
  day_part_boundary time not null default '13:00',
  lookahead_weeks smallint not null default 8,
  updated_at timestamptz not null default now(),
  constraint settings_singleton check (id),
  constraint settings_standard_shift_order check (standard_shift_end > standard_shift_start),
  constraint settings_saturday_shift_order check (saturday_shift_end > saturday_shift_start),
  constraint settings_lookahead_range check (lookahead_weeks between 1 and 52)
);
create or replace trigger set_updated_at before update on public.settings
  for each row execute function private.set_updated_at();

-- Norm: minimaal aantal mensen aan de balie per vestiging, weekdag en dagdeel (gebruikt vanaf fase 2).
create table if not exists public.staffing_norms (
  group_id text not null,
  has_counter boolean not null default true,
  weekday smallint not null,
  day_part text not null,
  min_staff smallint not null default 0,
  updated_at timestamptz not null default now(),
  primary key (group_id, weekday, day_part),
  constraint staffing_norms_counter_only check (has_counter),
  constraint staffing_norms_weekday_range check (weekday between 1 and 6),
  constraint staffing_norms_day_part check (day_part in ('morning', 'afternoon')),
  constraint staffing_norms_min_staff_range check (min_staff between 0 and 50),
  constraint staffing_norms_group_fkey foreign key (group_id, has_counter)
    references public.groups (id, has_counter) on update cascade on delete cascade
);
create or replace trigger set_updated_at before update on public.staffing_norms
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------
-- 20261001000200_employees.sql
-- ---------------------------------------------------------------------

-- Planbord · fase 1 · 02 medewerkers en accounts
-- Medewerkers, werkmail (apart, want alleen zichtbaar voor beheerder en medewerker zelf),
-- inzetbaarheid aan de balie, hulpfuncties voor RLS en de rechten op de basistabellen.

create table if not exists public.employees (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  group_id text not null references public.groups (id) on update cascade,
  default_role text not null default 'none',
  is_admin boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint employees_name_format check (
    name = btrim(name) and char_length(name) between 1 and 80 and name !~ '\s{2,}'
  ),
  constraint employees_default_role check (default_role in ('counter', 'backoffice', 'transport', 'cleaning', 'none'))
);
-- Namen zijn uniek, zonder op hoofdletters te letten: de import koppelt op naam.
create unique index if not exists employees_name_key on public.employees (lower(name));
create index if not exists employees_group_idx on public.employees (group_id);
create or replace trigger set_updated_at before update on public.employees
  for each row execute function private.set_updated_at();

create table if not exists public.employee_accounts (
  employee_id uuid primary key references public.employees (id) on delete cascade,
  email text not null,
  user_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint employee_accounts_email_key unique (email),
  constraint employee_accounts_user_id_key unique (user_id),
  constraint employee_accounts_email_format check (
    email = lower(btrim(email)) and char_length(email) <= 254 and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
  )
);
create or replace trigger set_updated_at before update on public.employee_accounts
  for each row execute function private.set_updated_at();

-- "Inzetbaar aan de balie in": alleen vestigingen (afgedwongen met de foreign key op has_counter).
create table if not exists public.counter_eligibility (
  employee_id uuid not null references public.employees (id) on delete cascade,
  group_id text not null,
  has_counter boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (employee_id, group_id),
  constraint counter_eligibility_counter_only check (has_counter),
  constraint counter_eligibility_group_fkey foreign key (group_id, has_counter)
    references public.groups (id, has_counter) on update cascade on delete cascade
);

-- Hulpfuncties voor de policies. security definer: ze lezen de accounttabel zonder RLS.
create or replace function private.current_employee_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select a.employee_id
  from public.employee_accounts a
  join public.employees e on e.id = a.employee_id
  where a.user_id = auth.uid() and e.is_active
$$;

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.employee_accounts a
    join public.employees e on e.id = a.employee_id
    where a.user_id = auth.uid() and e.is_active and e.is_admin
  )
$$;

revoke all on function private.current_employee_id() from public, anon, authenticated;
revoke all on function private.is_admin() from public, anon, authenticated;
grant execute on function private.current_employee_id() to authenticated, service_role;
grant execute on function private.is_admin() to authenticated, service_role;

-- Er moet altijd minstens één actieve beheerder overblijven.
create or replace function private.ensure_admin_remains()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.is_admin and old.is_active
     and not exists (select 1 from public.employees where is_admin and is_active) then
    raise exception 'Er moet minstens één actieve beheerder blijven.' using errcode = 'P0001';
  end if;
  return null;
end;
$$;
revoke all on function private.ensure_admin_remains() from public, anon, authenticated;
create or replace trigger ensure_admin_remains after update or delete on public.employees
  for each row execute function private.ensure_admin_remains();

-- Rechten: groepen. Iedereen leest; alleen de beheerder past de invalvolgorde aan.
alter table public.groups enable row level security;
revoke all on table public.groups from anon, authenticated;
grant select on table public.groups to authenticated;
grant update (substitution_rank) on table public.groups to authenticated;
grant all on table public.groups to service_role;
drop policy if exists groups_select on public.groups;
create policy groups_select on public.groups for select to authenticated
  using ((select private.current_employee_id()) is not null);
drop policy if exists groups_update on public.groups;
create policy groups_update on public.groups for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

-- Rechten: instellingen.
alter table public.settings enable row level security;
revoke all on table public.settings from anon, authenticated;
grant select on table public.settings to authenticated;
grant update (
  standard_shift_start, standard_shift_end, saturday_shift_start, saturday_shift_end,
  day_part_boundary, lookahead_weeks
) on table public.settings to authenticated;
grant all on table public.settings to service_role;
drop policy if exists settings_select on public.settings;
create policy settings_select on public.settings for select to authenticated
  using ((select private.current_employee_id()) is not null);
drop policy if exists settings_update on public.settings;
create policy settings_update on public.settings for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

-- Rechten: normen.
alter table public.staffing_norms enable row level security;
revoke all on table public.staffing_norms from anon, authenticated;
grant select on table public.staffing_norms to authenticated;
grant update (min_staff) on table public.staffing_norms to authenticated;
grant all on table public.staffing_norms to service_role;
drop policy if exists staffing_norms_select on public.staffing_norms;
create policy staffing_norms_select on public.staffing_norms for select to authenticated
  using ((select private.current_employee_id()) is not null);
drop policy if exists staffing_norms_update on public.staffing_norms;
create policy staffing_norms_update on public.staffing_norms for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

-- Rechten: medewerkers. Iedereen ziet de actieve collega's; de beheerder ziet en wijzigt alles.
-- Verwijderen kan in fase 1 niet (fase 3: volledig verwijderen via de server).
alter table public.employees enable row level security;
revoke all on table public.employees from anon, authenticated;
grant select on table public.employees to authenticated;
grant insert (name, group_id, default_role, is_admin, is_active) on table public.employees to authenticated;
grant update (name, group_id, default_role, is_admin, is_active) on table public.employees to authenticated;
grant all on table public.employees to service_role;
drop policy if exists employees_select on public.employees;
create policy employees_select on public.employees for select to authenticated
  using ((select private.is_admin()) or (is_active and (select private.current_employee_id()) is not null));
drop policy if exists employees_insert on public.employees;
create policy employees_insert on public.employees for insert to authenticated
  with check ((select private.is_admin()));
drop policy if exists employees_update on public.employees;
create policy employees_update on public.employees for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

-- Rechten: werkmail. Alleen de beheerder en de medewerker zelf. De koppeling met het
-- inlogaccount (user_id) zet de server of claim_account(), nooit de client.
alter table public.employee_accounts enable row level security;
revoke all on table public.employee_accounts from anon, authenticated;
grant select, delete on table public.employee_accounts to authenticated;
grant insert (employee_id, email) on table public.employee_accounts to authenticated;
grant update (email) on table public.employee_accounts to authenticated;
grant all on table public.employee_accounts to service_role;
drop policy if exists employee_accounts_select on public.employee_accounts;
create policy employee_accounts_select on public.employee_accounts for select to authenticated
  using ((select private.is_admin()) or employee_id = (select private.current_employee_id()));
drop policy if exists employee_accounts_insert on public.employee_accounts;
create policy employee_accounts_insert on public.employee_accounts for insert to authenticated
  with check ((select private.is_admin()));
drop policy if exists employee_accounts_update on public.employee_accounts;
create policy employee_accounts_update on public.employee_accounts for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
drop policy if exists employee_accounts_delete on public.employee_accounts;
create policy employee_accounts_delete on public.employee_accounts for delete to authenticated
  using ((select private.is_admin()));

-- Rechten: inzetbaarheid aan de balie.
alter table public.counter_eligibility enable row level security;
revoke all on table public.counter_eligibility from anon, authenticated;
grant select, delete on table public.counter_eligibility to authenticated;
grant insert (employee_id, group_id) on table public.counter_eligibility to authenticated;
grant all on table public.counter_eligibility to service_role;
drop policy if exists counter_eligibility_select on public.counter_eligibility;
create policy counter_eligibility_select on public.counter_eligibility for select to authenticated
  using ((select private.current_employee_id()) is not null);
drop policy if exists counter_eligibility_insert on public.counter_eligibility;
create policy counter_eligibility_insert on public.counter_eligibility for insert to authenticated
  with check ((select private.is_admin()));
drop policy if exists counter_eligibility_delete on public.counter_eligibility;
create policy counter_eligibility_delete on public.counter_eligibility for delete to authenticated
  using ((select private.is_admin()));

-- ---------------------------------------------------------------------
-- 20261001000300_recurring_shifts.sql
-- ---------------------------------------------------------------------

-- Planbord · fase 1 · 03 vaste diensten
-- Het rooster wordt per datum berekend uit deze vaste diensten; weekroosters worden nooit opgeslagen.

create table if not exists public.recurring_shifts (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees (id) on delete cascade,
  weekday smallint not null,
  group_id text not null references public.groups (id) on update cascade,
  role text not null,
  -- Leeg = de standaardtijd uit de instellingen (per veld).
  start_time time,
  end_time time,
  valid_from date not null,
  -- Leeg = onbepaald. Inclusief.
  valid_to date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint recurring_shifts_weekday_range check (weekday between 1 and 6),
  constraint recurring_shifts_role check (role in ('counter', 'backoffice', 'transport', 'cleaning', 'none')),
  constraint recurring_shifts_time_order check (start_time is null or end_time is null or end_time > start_time),
  constraint recurring_shifts_valid_range check (valid_to is null or valid_to >= valid_from),
  constraint recurring_shifts_date_bounds check (
    valid_from >= date '2000-01-01' and (valid_to is null or valid_to <= date '2100-12-31')
  ),
  -- Per medewerker per weekdag geldt op elke datum hoogstens één vaste dienst.
  constraint recurring_shifts_no_overlap exclude using gist (
    employee_id with =,
    weekday with =,
    daterange(valid_from, valid_to, '[]') with &&
  )
);
create index if not exists recurring_shifts_employee_idx on public.recurring_shifts (employee_id, weekday);
create or replace trigger set_updated_at before update on public.recurring_shifts
  for each row execute function private.set_updated_at();

alter table public.recurring_shifts enable row level security;
revoke all on table public.recurring_shifts from anon, authenticated;
grant select, delete on table public.recurring_shifts to authenticated;
grant insert (employee_id, weekday, group_id, role, start_time, end_time, valid_from, valid_to)
  on table public.recurring_shifts to authenticated;
grant update (group_id, role, start_time, end_time, valid_from, valid_to)
  on table public.recurring_shifts to authenticated;
grant all on table public.recurring_shifts to service_role;
drop policy if exists recurring_shifts_select on public.recurring_shifts;
create policy recurring_shifts_select on public.recurring_shifts for select to authenticated
  using ((select private.current_employee_id()) is not null);
drop policy if exists recurring_shifts_insert on public.recurring_shifts;
create policy recurring_shifts_insert on public.recurring_shifts for insert to authenticated
  with check ((select private.is_admin()));
drop policy if exists recurring_shifts_update on public.recurring_shifts;
create policy recurring_shifts_update on public.recurring_shifts for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
drop policy if exists recurring_shifts_delete on public.recurring_shifts;
create policy recurring_shifts_delete on public.recurring_shifts for delete to authenticated
  using ((select private.is_admin()));

-- ---------------------------------------------------------------------
-- 20261001000400_absences_closures.sql
-- ---------------------------------------------------------------------

-- Planbord · fase 1 · 04 afwezigheid en sluitingsdagen
-- Afwezigheid heeft bewust géén reden, soort of tekstveld: alles heet "Afwezig".

create table if not exists public.absences (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees (id) on delete cascade,
  start_date date not null,
  end_date date not null,
  day_part text not null default 'full_day',
  -- requested = aangevraagd (nog niet verwerkt in MyHR), approved = goedgekeurd. Beide tellen als afwezig.
  status text not null default 'approved',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint absences_day_part check (day_part in ('full_day', 'morning', 'afternoon')),
  constraint absences_status check (status in ('requested', 'approved')),
  constraint absences_date_order check (end_date >= start_date),
  constraint absences_half_day_single_date check (day_part = 'full_day' or start_date = end_date),
  constraint absences_date_bounds check (start_date >= date '2000-01-01' and end_date <= date '2100-12-31'),
  -- Ook de sleutel voor de import: opnieuw importeren maakt geen dubbelingen.
  constraint absences_unique unique (employee_id, start_date, end_date, day_part)
);
create index if not exists absences_dates_idx on public.absences (end_date, start_date);
create or replace trigger set_updated_at before update on public.absences
  for each row execute function private.set_updated_at();

alter table public.absences enable row level security;
revoke all on table public.absences from anon, authenticated;
grant select, delete on table public.absences to authenticated;
grant insert (employee_id, start_date, end_date, day_part, status) on table public.absences to authenticated;
grant update (employee_id, start_date, end_date, day_part, status) on table public.absences to authenticated;
grant all on table public.absences to service_role;
drop policy if exists absences_select on public.absences;
create policy absences_select on public.absences for select to authenticated
  using ((select private.current_employee_id()) is not null);
drop policy if exists absences_insert on public.absences;
create policy absences_insert on public.absences for insert to authenticated
  with check ((select private.is_admin()));
drop policy if exists absences_update on public.absences;
create policy absences_update on public.absences for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
drop policy if exists absences_delete on public.absences;
create policy absences_delete on public.absences for delete to authenticated
  using ((select private.is_admin()));

-- Afwijkingen op de berekende feestdagen. group_id leeg = alle groepen.
-- is_closed true = (extra) dicht, false = toch open.
create table if not exists public.closure_days (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  group_id text references public.groups (id) on update cascade on delete cascade,
  is_closed boolean not null,
  label text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint closure_days_label_format check (label is null or (label = btrim(label) and char_length(label) between 1 and 60)),
  constraint closure_days_date_bounds check (date between date '2000-01-01' and date '2100-12-31'),
  constraint closure_days_unique unique nulls not distinct (date, group_id)
);
create or replace trigger set_updated_at before update on public.closure_days
  for each row execute function private.set_updated_at();

alter table public.closure_days enable row level security;
revoke all on table public.closure_days from anon, authenticated;
grant select, delete on table public.closure_days to authenticated;
grant insert (date, group_id, is_closed, label) on table public.closure_days to authenticated;
grant update (is_closed, label) on table public.closure_days to authenticated;
grant all on table public.closure_days to service_role;
drop policy if exists closure_days_select on public.closure_days;
create policy closure_days_select on public.closure_days for select to authenticated
  using ((select private.current_employee_id()) is not null);
drop policy if exists closure_days_insert on public.closure_days;
create policy closure_days_insert on public.closure_days for insert to authenticated
  with check ((select private.is_admin()));
drop policy if exists closure_days_update on public.closure_days;
create policy closure_days_update on public.closure_days for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
drop policy if exists closure_days_delete on public.closure_days;
create policy closure_days_delete on public.closure_days for delete to authenticated
  using ((select private.is_admin()));

-- ---------------------------------------------------------------------
-- 20261001000500_calendar_feeds.sql
-- ---------------------------------------------------------------------

-- Planbord · fase 1 · 05 agendafeeds
-- Alleen de SHA-256-hash van het token wordt bewaard; de link zelf is alleen bij het aanmaken te zien.

create table if not exists public.calendar_feeds (
  id uuid primary key default gen_random_uuid(),
  -- De eigenaar van de link.
  employee_id uuid not null references public.employees (id) on delete cascade,
  kind text not null,
  -- Alleen bij een vestigingsfeed.
  group_id text references public.groups (id) on update cascade on delete cascade,
  token_hash text not null,
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  constraint calendar_feeds_kind check (kind in ('personal', 'location', 'absences')),
  constraint calendar_feeds_group check ((kind = 'location') = (group_id is not null)),
  constraint calendar_feeds_token_hash_format check (token_hash ~ '^[0-9a-f]{64}$'),
  constraint calendar_feeds_token_hash_key unique (token_hash)
);
-- Per eigenaar per feed hoogstens één actieve link.
create unique index if not exists calendar_feeds_active_key
  on public.calendar_feeds (employee_id, kind, coalesce(group_id, ''))
  where revoked_at is null;

alter table public.calendar_feeds enable row level security;
revoke all on table public.calendar_feeds from anon, authenticated;
grant select on table public.calendar_feeds to authenticated;
grant insert (employee_id, kind, group_id, token_hash) on table public.calendar_feeds to authenticated;
grant update (revoked_at) on table public.calendar_feeds to authenticated;
grant all on table public.calendar_feeds to service_role;
drop policy if exists calendar_feeds_select on public.calendar_feeds;
create policy calendar_feeds_select on public.calendar_feeds for select to authenticated
  using (employee_id = (select private.current_employee_id()) or (select private.is_admin()));
-- Een link maak je alleen voor jezelf: alleen jij krijgt hem te zien.
drop policy if exists calendar_feeds_insert on public.calendar_feeds;
create policy calendar_feeds_insert on public.calendar_feeds for insert to authenticated
  with check (employee_id = (select private.current_employee_id()) and revoked_at is null);
-- Intrekken mag de eigenaar en de beheerder. Een ingetrokken link kan niet terug.
drop policy if exists calendar_feeds_update on public.calendar_feeds;
create policy calendar_feeds_update on public.calendar_feeds for update to authenticated
  using ((employee_id = (select private.current_employee_id()) or (select private.is_admin())) and revoked_at is null)
  with check (revoked_at is not null);

-- ---------------------------------------------------------------------
-- 20261001000600_audit_log.sql
-- ---------------------------------------------------------------------

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

-- ---------------------------------------------------------------------
-- 20261001000700_rpc.sql
-- ---------------------------------------------------------------------

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

    if nullif(item ->> 'id', '') is null then
      insert into public.recurring_shifts (employee_id, weekday, group_id, role, start_time, end_time, valid_from)
      values (
        owner,
        (item ->> 'weekday')::smallint,
        item ->> 'group_id',
        item ->> 'role',
        (item ->> 'start_time')::time,
        (item ->> 'end_time')::time,
        (item ->> 'valid_from')::date
      );
      shifts_created := shifts_created + 1;
    else
      update public.recurring_shifts
         set group_id = item ->> 'group_id',
             role = item ->> 'role',
             start_time = (item ->> 'start_time')::time,
             end_time = (item ->> 'end_time')::time
       where id = (item ->> 'id')::uuid and employee_id = owner;
      get diagnostics affected = row_count;
      if affected = 0 then
        raise exception 'Een vaste dienst bestaat niet meer. Laad de import opnieuw.';
      end if;
      shifts_updated := shifts_updated + 1;
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

-- ---------------------------------------------------------------------
-- 20261001000800_seed.sql
-- ---------------------------------------------------------------------

-- Planbord · fase 1 · 08 seed
-- De groepen, instellingen, normen en invalvolgorde uit de opdracht. Geen medewerkers:
-- de eerste beheerder maak je aan met de stappen in de README.
-- Bestaande waarden worden nooit overschreven.

do $$
begin
  perform set_config('app.audit_source', 'setup', true);

  -- Invalvolgorde (fase 2): Backoffice, Overig, een andere vestiging, Logistiek.
  insert into public.groups (id, name, has_counter, sort_order, substitution_rank) values
    ('den_bosch', 'Den Bosch', true, 1, 3),
    ('eindhoven', 'Eindhoven', true, 2, 3),
    ('breda', 'Breda', true, 3, 3),
    ('logistics', 'Logistiek', false, 4, 4),
    ('backoffice', 'Backoffice', false, 5, 1),
    ('other', 'Overig', false, 6, 2)
  on conflict (id) do nothing;

  -- Standaarddienst 07:30–18:00 (ook op zaterdag), dagdeelgrens 13:00, 8 weken vooruitkijken.
  insert into public.settings (id) values (true)
  on conflict (id) do nothing;

  -- Norm: 2 mensen aan de balie per vestiging, ma–vr, 's ochtends en 's middags. Zaterdag geen norm.
  insert into public.staffing_norms (group_id, weekday, day_part, min_staff)
  select g.id, d.weekday, p.day_part, case when d.weekday <= 5 then 2 else 0 end
    from public.groups g
   cross join generate_series(1, 6) as d(weekday)
   cross join (values ('morning'), ('afternoon')) as p(day_part)
   where g.has_counter
  on conflict (group_id, weekday, day_part) do nothing;
end;
$$;

commit;
