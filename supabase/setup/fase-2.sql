-- =====================================================================
-- Planbord · Fase 2: het brein
--
-- Draai eerst fase-1.sql. Deze bundel voegt alleen tabellen en functies toe; de app van fase 1 merkt er niets van.
--
-- Plak dit hele bestand in Supabase: SQL Editor → New query → Run.
-- Het is veilig om opnieuw te draaien: bestaande tabellen en gegevens blijven staan.
--
-- Gegenereerd met `npm run db:bundle` uit supabase/migrations. Niet met de hand aanpassen.
-- =====================================================================

begin;
-- ---------------------------------------------------------------------
-- 20261002000100_substitutions.sql
-- ---------------------------------------------------------------------

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

-- ---------------------------------------------------------------------
-- 20261002000200_shift_overrides.sql
-- ---------------------------------------------------------------------

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

-- ---------------------------------------------------------------------
-- 20261002000300_gap_dismissals.sql
-- ---------------------------------------------------------------------

-- Planbord · fase 2 · 03 genegeerde gaten
-- Een beheerder kan een gat negeren. Het blijft weg zolang het tekort niet groter wordt
-- dan bij het negeren. Alleen voor beheerders.

create table if not exists public.gap_dismissals (
  id uuid primary key default gen_random_uuid(),
  group_id text not null references public.groups (id) on update cascade on delete cascade,
  date date not null,
  day_part text not null,
  -- Het tekort op het moment van negeren.
  shortage smallint not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint gap_dismissals_day_part check (day_part in ('morning', 'afternoon')),
  constraint gap_dismissals_shortage check (shortage between 1 and 50),
  constraint gap_dismissals_date_bounds check (date between date '2000-01-01' and date '2100-12-31'),
  constraint gap_dismissals_unique unique (group_id, date, day_part)
);
create or replace trigger set_updated_at before update on public.gap_dismissals
  for each row execute function private.set_updated_at();

alter table public.gap_dismissals enable row level security;
revoke all on table public.gap_dismissals from anon, authenticated;
grant select, delete on table public.gap_dismissals to authenticated;
grant insert (group_id, date, day_part, shortage) on table public.gap_dismissals to authenticated;
grant update (shortage) on table public.gap_dismissals to authenticated;
grant all on table public.gap_dismissals to service_role;
drop policy if exists gap_dismissals_select on public.gap_dismissals;
create policy gap_dismissals_select on public.gap_dismissals for select to authenticated
  using ((select private.is_admin()));
drop policy if exists gap_dismissals_insert on public.gap_dismissals;
create policy gap_dismissals_insert on public.gap_dismissals for insert to authenticated
  with check ((select private.is_admin()));
drop policy if exists gap_dismissals_update on public.gap_dismissals;
create policy gap_dismissals_update on public.gap_dismissals for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
drop policy if exists gap_dismissals_delete on public.gap_dismissals;
create policy gap_dismissals_delete on public.gap_dismissals for delete to authenticated
  using ((select private.is_admin()));

-- ---------------------------------------------------------------------
-- 20261002000400_audit_phase2.sql
-- ---------------------------------------------------------------------

-- Planbord · fase 2 · 04 logboek voor invallen, roosterwijzigingen en genegeerde gaten
-- Net als in fase 1: alleen deze velden met waarde, nooit namen.

create or replace trigger audit after insert or update or delete on public.substitutions
  for each row execute function private.audit_row('date', 'group_id', 'day_part', 'status', 'handled_at');
create or replace trigger audit after insert or update or delete on public.shift_overrides
  for each row execute function private.audit_row('date', 'kind', 'group_id', 'role', 'start_time', 'end_time');
create or replace trigger audit after insert or update or delete on public.gap_dismissals
  for each row execute function private.audit_row('group_id', 'date', 'day_part', 'shortage');

-- ---------------------------------------------------------------------
-- 20261002000500_rpc_phase2.sql
-- ---------------------------------------------------------------------

-- Planbord · fase 2 · 05 functies die de app aanroept
-- Allemaal security invoker: de gewone rechten (RLS) gelden, dus alleen een beheerder kan dit.

-- Zet de roosterwijziging van één medewerker op één datum, nieuw of in plaats van de vorige.
create or replace function public.set_shift_override(
  p_employee_id uuid,
  p_date date,
  p_kind text,
  p_group_id text,
  p_role text,
  p_start_time time,
  p_end_time time
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  result uuid;
begin
  insert into public.shift_overrides as o (employee_id, date, kind, group_id, role, start_time, end_time)
  values (p_employee_id, p_date, p_kind, p_group_id, p_role, p_start_time, p_end_time)
  on conflict (employee_id, date) do update
    set kind = excluded.kind,
        group_id = excluded.group_id,
        role = excluded.role,
        start_time = excluded.start_time,
        end_time = excluded.end_time
  returning o.id into result;
  return result;
end;
$$;
revoke all on function public.set_shift_override(uuid, date, text, text, text, time, time) from public, anon, authenticated;
grant execute on function public.set_shift_override(uuid, date, text, text, text, time, time) to authenticated;

-- Verplaatsen (besluit V6): geen dienst op de oude dag en een dienst op de nieuwe dag, in één keer.
create or replace function public.move_shift(
  p_employee_id uuid,
  p_from date,
  p_to date,
  p_group_id text,
  p_role text,
  p_start_time time,
  p_end_time time
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if p_from = p_to then
    raise exception 'Kies een andere dag om de dienst naartoe te verplaatsen.' using errcode = '22023';
  end if;
  perform public.set_shift_override(p_employee_id, p_from, 'off', null, null, null, null);
  return public.set_shift_override(p_employee_id, p_to, 'shift', p_group_id, p_role, p_start_time, p_end_time);
end;
$$;
revoke all on function public.move_shift(uuid, date, date, text, text, time, time) from public, anon, authenticated;
grant execute on function public.move_shift(uuid, date, date, text, text, time, time) to authenticated;

-- Past de uitkomst van de controle op achterhaalde invallen toe (besluit V10), in één transactie.
-- Alleen invallen die nog doorgaan, veranderen van status. In het logboek staat dit als 'controle'.
create or replace function public.apply_substitution_review(changes jsonb)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  item jsonb;
  affected integer;
  total integer := 0;
begin
  if not private.is_admin() then
    raise exception 'Alleen een beheerder kan invallen wijzigen.' using errcode = '42501';
  end if;
  perform set_config('app.audit_source', 'controle', true);
  for item in select value from jsonb_array_elements(coalesce(changes, '[]'::jsonb)) loop
    if coalesce(item ->> 'status', '') not in ('not_needed', 'reschedule') then
      raise exception 'Onbekende status voor een inval.' using errcode = '22023';
    end if;
    update public.substitutions
       set status = item ->> 'status'
     where id = (item ->> 'id')::uuid
       and status = 'active';
    get diagnostics affected = row_count;
    total := total + affected;
  end loop;
  return total;
end;
$$;
revoke all on function public.apply_substitution_review(jsonb) from public, anon, authenticated;
grant execute on function public.apply_substitution_review(jsonb) to authenticated;

commit;
