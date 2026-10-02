-- Planbord · fase 2 · 01 invallen
-- Een inval: iemand werkt in één of twee dagdelen aan de balie van een andere vestiging.
-- Alleen een beheerder wijst een inval toe. Een inval wordt nooit verwijderd, alleen van status veranderd.

create table if not exists public.substitutions (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees (id) on delete cascade,
  date date not null,
  -- De vestiging waar de inval is.
  group_id text not null references public.groups (id) on update cascade,
  day_part text not null default 'full_day',
  -- active = gaat door; not_needed = niet meer nodig; reschedule = opnieuw regelen (de invaller is zelf afwezig).
  status text not null default 'active',
  -- Wanneer de beheerder een vervallen inval heeft afgehandeld (de invaller is ingelicht).
  handled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint substitutions_day_part check (day_part in ('full_day', 'morning', 'afternoon')),
  constraint substitutions_status check (status in ('active', 'not_needed', 'reschedule')),
  constraint substitutions_date_bounds check (date between date '2000-01-01' and date '2100-12-31'),
  constraint substitutions_handled_when_inactive check (handled_at is null or status <> 'active')
);
-- Per medewerker per dag hooguit één inval die doorgaat.
create unique index if not exists substitutions_one_active_per_day
  on public.substitutions (employee_id, date) where status = 'active';
create index if not exists substitutions_date_idx on public.substitutions (date);
create or replace trigger set_updated_at before update on public.substitutions
  for each row execute function private.set_updated_at();

-- Invallen kan alleen in een vestiging met een balie.
create or replace function private.check_substitution_group()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (select 1 from public.groups g where g.id = new.group_id and g.has_counter) then
    raise exception 'Invallen kan alleen in een vestiging met een balie.' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function private.check_substitution_group() from public, anon, authenticated;
create or replace trigger check_group before insert or update of group_id on public.substitutions
  for each row execute function private.check_substitution_group();

alter table public.substitutions enable row level security;
revoke all on table public.substitutions from anon, authenticated;
grant select on table public.substitutions to authenticated;
grant insert (employee_id, date, group_id, day_part) on table public.substitutions to authenticated;
grant update (day_part, status, handled_at) on table public.substitutions to authenticated;
grant all on table public.substitutions to service_role;
drop policy if exists substitutions_select on public.substitutions;
create policy substitutions_select on public.substitutions for select to authenticated
  using ((select private.current_employee_id()) is not null);
drop policy if exists substitutions_insert on public.substitutions;
create policy substitutions_insert on public.substitutions for insert to authenticated
  with check ((select private.is_admin()));
drop policy if exists substitutions_update on public.substitutions;
create policy substitutions_update on public.substitutions for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
