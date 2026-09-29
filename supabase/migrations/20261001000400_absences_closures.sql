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
