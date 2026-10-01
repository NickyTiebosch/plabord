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
