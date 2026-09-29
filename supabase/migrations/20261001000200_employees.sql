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
