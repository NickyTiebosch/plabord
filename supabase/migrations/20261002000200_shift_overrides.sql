-- Planbord · fase 2 · 02 roosterwijzigingen voor één dag
-- Een wijziging bepaalt de dienst van een medewerker op één datum helemaal:
-- off = geen dienst; shift = deze dienst (in plaats van de vaste dienst, of erbij).
-- De vaste diensten blijven ongemoeid.

create table if not exists public.shift_overrides (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees (id) on delete cascade,
  date date not null,
  kind text not null,
  group_id text references public.groups (id) on update cascade,
  role text,
  -- Leeg = de standaardtijd uit de instellingen (per veld), net als bij vaste diensten.
  start_time time,
  end_time time,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shift_overrides_kind check (kind in ('off', 'shift')),
  constraint shift_overrides_role check (role is null or role in ('counter', 'backoffice', 'transport', 'cleaning', 'none')),
  constraint shift_overrides_shape check (
    (kind = 'off' and group_id is null and role is null and start_time is null and end_time is null)
    or (kind = 'shift' and group_id is not null and role is not null)
  ),
  constraint shift_overrides_time_order check (start_time is null or end_time is null or end_time > start_time),
  -- Net als vaste diensten: maandag t/m zaterdag.
  constraint shift_overrides_weekday check (extract(isodow from date) between 1 and 6),
  constraint shift_overrides_date_bounds check (date between date '2000-01-01' and date '2100-12-31'),
  constraint shift_overrides_unique unique (employee_id, date)
);
create index if not exists shift_overrides_date_idx on public.shift_overrides (date);
create or replace trigger set_updated_at before update on public.shift_overrides
  for each row execute function private.set_updated_at();

alter table public.shift_overrides enable row level security;
revoke all on table public.shift_overrides from anon, authenticated;
grant select, delete on table public.shift_overrides to authenticated;
grant insert (employee_id, date, kind, group_id, role, start_time, end_time) on table public.shift_overrides to authenticated;
grant update (kind, group_id, role, start_time, end_time) on table public.shift_overrides to authenticated;
grant all on table public.shift_overrides to service_role;
drop policy if exists shift_overrides_select on public.shift_overrides;
create policy shift_overrides_select on public.shift_overrides for select to authenticated
  using ((select private.current_employee_id()) is not null);
drop policy if exists shift_overrides_insert on public.shift_overrides;
create policy shift_overrides_insert on public.shift_overrides for insert to authenticated
  with check ((select private.is_admin()));
drop policy if exists shift_overrides_update on public.shift_overrides;
create policy shift_overrides_update on public.shift_overrides for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
drop policy if exists shift_overrides_delete on public.shift_overrides;
create policy shift_overrides_delete on public.shift_overrides for delete to authenticated
  using ((select private.is_admin()));
