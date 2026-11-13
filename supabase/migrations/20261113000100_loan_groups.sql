-- Planbord · fase 5 · 04 welke vestigingen auto's uitlenen (besluit V52)
-- Alleen Den Bosch geeft auto's mee aan Mobiliteit. De uitleen is daarom alleen zichtbaar voor wie
-- er iets mee doet: collega's van een vestiging die uitleent, collega's die daar aan de balie mogen
-- invallen, en de beheerder en teamleider. Welke vestigingen uitlenen, is een instelling.

-- Bij het toevoegen van de kolom leent alleen Den Bosch uit; daarna verandert de setup dat nooit meer.
do $$
begin
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'groups' and column_name = 'lends_vehicles'
  ) then
    alter table public.groups add column lends_vehicles boolean not null default false;
    perform set_config('app.audit_source', 'setup', true);
    update public.groups set lends_vehicles = true where id = 'den_bosch';
    perform set_config('app.audit_source', '', true);
  end if;
end;
$$;
alter table public.groups drop constraint if exists groups_lends_vehicles_counter_only;
alter table public.groups add constraint groups_lends_vehicles_counter_only check (has_counter or not lends_vehicles);
grant update (lends_vehicles) on table public.groups to authenticated;

create or replace trigger audit after insert or update or delete on public.groups
  for each row execute function private.audit_row(
    'name', 'has_counter', 'sort_order', 'substitution_rank', 'mobility_loans_per_day', 'lends_vehicles'
  );

-- Mag de ingelogde medewerker de uitleen gebruiken?
create or replace function private.uses_loans()
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
    where a.user_id = auth.uid() and e.is_active
      and (
        e.is_admin or e.is_team_lead
        or exists (select 1 from public.groups g where g.id = e.group_id and g.lends_vehicles)
        or exists (
          select 1 from public.counter_eligibility c
          join public.groups g on g.id = c.group_id
          where c.employee_id = e.id and g.lends_vehicles
        )
      )
  )
$$;
revoke all on function private.uses_loans() from public, anon, authenticated;
grant execute on function private.uses_loans() to authenticated, service_role;

-- Voor de app: bepaalt of het onderdeel Uitleen in beeld komt.
create or replace function public.uses_loans()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select private.uses_loans()
$$;
revoke execute on function public.uses_loans() from public, anon;
grant execute on function public.uses_loans() to authenticated;

-- Lezen en aanmelden: alleen wie de uitleen gebruikt.
drop policy if exists vehicle_loans_select on public.vehicle_loans;
create policy vehicle_loans_select on public.vehicle_loans for select to authenticated
  using ((select private.uses_loans()));
drop policy if exists vehicle_loans_insert on public.vehicle_loans;
create policy vehicle_loans_insert on public.vehicle_loans for insert to authenticated
  with check (
    (select private.uses_loans())
    and handed_out_by = (select private.current_employee_id())
    and returned_at is null
  );

-- Een auto hoort bij een vestiging die uitleent. En wie de uitleen niet gebruikt, kan ook via de
-- functies voor retour niets wijzigen.
create or replace function private.check_vehicle_loan()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null and not private.uses_loans() then
    raise exception 'Je hebt geen rechten voor de uitleen.' using errcode = '42501';
  end if;
  if (tg_op = 'INSERT' or new.group_id is distinct from old.group_id)
     and not exists (select 1 from public.groups g where g.id = new.group_id and g.lends_vehicles) then
    raise exception 'Deze vestiging leent geen auto''s uit.';
  end if;
  return new;
end;
$$;
revoke all on function private.check_vehicle_loan() from public, anon, authenticated;
create or replace trigger check_loan before insert or update on public.vehicle_loans
  for each row execute function private.check_vehicle_loan();
