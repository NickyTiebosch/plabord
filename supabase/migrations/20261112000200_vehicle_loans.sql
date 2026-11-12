-- Planbord · fase 5 · 02 de uitleen (besluiten V45–V49)
-- Auto's die verhuur meegeeft aan Mobiliteit (vervangend vervoer voor stranders) of aan de
-- werkplaats voor het weekend. Verhuur meldt de auto aan en weer retour, ingezet of niet ingezet.
-- Alleen wat de registratie nodig heeft: geen klantnamen of andere klantgegevens (besluit V41).

-- Per vestiging: hoeveel auto's Mobiliteit per werkdag minstens krijgt (V48). Een ondergrens voor de
-- controle, geen maximum. 0 = geen controle. Bij het toevoegen van de kolom krijgen de vestigingen
-- met een balie 2; daarna verandert de setup die waarde nooit meer.
do $$
begin
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'groups' and column_name = 'mobility_loans_per_day'
  ) then
    alter table public.groups add column mobility_loans_per_day smallint not null default 0;
    perform set_config('app.audit_source', 'setup', true);
    update public.groups set mobility_loans_per_day = 2 where has_counter;
    perform set_config('app.audit_source', '', true);
  end if;
end;
$$;
alter table public.groups drop constraint if exists groups_mobility_loans_range;
alter table public.groups add constraint groups_mobility_loans_range check (mobility_loans_per_day between 0 and 20);
grant update (mobility_loans_per_day) on table public.groups to authenticated;

create or replace trigger audit after insert or update or delete on public.groups
  for each row execute function private.audit_row(
    'name', 'has_counter', 'sort_order', 'substitution_rank', 'mobility_loans_per_day'
  );

create table if not exists public.vehicle_loans (
  id uuid primary key default gen_random_uuid(),
  -- De vestiging die de auto meegaf. Alleen vestigingen met een balie.
  group_id text not null,
  has_counter boolean not null default true,
  -- Zonder streepjes en spaties, in hoofdletters: GHP39K.
  license_plate text not null,
  model text not null,
  -- mobility = Mobiliteit; workshop_weekend = de werkplaats in het weekend.
  destination text not null,
  -- Aan wie de auto is meegegeven: de naam van een persoon of een afdeling.
  handed_to text not null,
  -- Wie de auto meegaf. Leeg als die medewerker volledig is verwijderd.
  handed_out_by uuid references public.employees (id) on delete set null,
  handed_out_at timestamptz not null default now(),
  odometer_out integer,
  -- Leeg zolang de auto uit staat.
  returned_at timestamptz,
  returned_by uuid references public.employees (id) on delete set null,
  odometer_in integer,
  -- Ingezet ja of nee; leeg zolang de auto uit staat.
  was_used boolean,
  note text,
  return_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint vehicle_loans_counter_only check (has_counter),
  constraint vehicle_loans_group_fkey foreign key (group_id, has_counter)
    references public.groups (id, has_counter) on update cascade,
  constraint vehicle_loans_plate_format check (license_plate ~ '^[A-Z0-9]{2,10}$'),
  constraint vehicle_loans_model_format check (model = btrim(model) and char_length(model) between 1 and 40),
  constraint vehicle_loans_destination check (destination in ('mobility', 'workshop_weekend')),
  constraint vehicle_loans_handed_to_format check (handed_to = btrim(handed_to) and char_length(handed_to) between 1 and 60),
  constraint vehicle_loans_note_format check (note is null or (note = btrim(note) and char_length(note) between 1 and 200)),
  constraint vehicle_loans_return_note_format check (
    return_note is null or (return_note = btrim(return_note) and char_length(return_note) between 1 and 200)
  ),
  constraint vehicle_loans_odometer_range check (
    (odometer_out is null or odometer_out between 0 and 2000000)
    and (odometer_in is null or odometer_in between 0 and 2000000)
  ),
  constraint vehicle_loans_odometer_order check (odometer_in is null or odometer_out is null or odometer_in >= odometer_out),
  constraint vehicle_loans_moment_bounds check (
    handed_out_at >= timestamptz '2000-01-01 00:00:00+00' and handed_out_at < timestamptz '2100-01-01 00:00:00+00'
  ),
  -- Retour: tijdstip en ingezet horen bij elkaar; zonder retour geen retourgegevens.
  constraint vehicle_loans_return_shape check (
    (returned_at is null) = (was_used is null)
    and (returned_at is not null or (returned_by is null and odometer_in is null and return_note is null))
  ),
  constraint vehicle_loans_return_order check (returned_at is null or returned_at >= handed_out_at)
);
-- Een auto kan maar één keer tegelijk uitgeleend staan.
create unique index if not exists vehicle_loans_one_open_per_plate
  on public.vehicle_loans (license_plate) where returned_at is null;
create index if not exists vehicle_loans_handed_out_idx on public.vehicle_loans (handed_out_at desc);
create index if not exists vehicle_loans_returned_idx on public.vehicle_loans (returned_at);
create or replace trigger set_updated_at before update on public.vehicle_loans
  for each row execute function private.set_updated_at();

-- Aanmelden gaat altijd op eigen naam: de database vult in wie het doet.
create or replace function private.set_vehicle_loan_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null then
    new.handed_out_by := private.current_employee_id();
  end if;
  return new;
end;
$$;
revoke all on function private.set_vehicle_loan_owner() from public, anon, authenticated;
create or replace trigger set_owner before insert on public.vehicle_loans
  for each row execute function private.set_vehicle_loan_owner();

-- Bewaren (V49): 24 maanden na retour verdwijnt een registratie, bij het volgende aanmelden.
-- In het logboek staat dat als opruimen.
create or replace function private.clean_vehicle_loans()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  previous text := current_setting('app.audit_source', true);
begin
  if exists (select 1 from public.vehicle_loans where returned_at < now() - interval '24 months') then
    perform set_config('app.audit_source', 'opruimen', true);
    delete from public.vehicle_loans where returned_at < now() - interval '24 months';
    perform set_config('app.audit_source', coalesce(previous, ''), true);
  end if;
  return null;
end;
$$;
revoke all on function private.clean_vehicle_loans() from public, anon, authenticated;
create or replace trigger clean_old after insert on public.vehicle_loans
  for each statement execute function private.clean_vehicle_loans();

-- Het logboek: geen vrije tekst (niet aan wie, geen opmerkingen), wel kenteken, vestiging en tijdstippen.
create or replace trigger audit after insert or update or delete on public.vehicle_loans
  for each row execute function private.audit_row(
    'group_id', 'license_plate', 'destination', 'handed_out_at', 'returned_at', 'was_used'
  );

-- Rechten. Iedereen leest. Aanmelden: iedere actieve medewerker, op eigen naam en nog niet retour.
-- Retour melden en ongedaan maken gaan via functies. Corrigeren en verwijderen: beheerder of teamleider.
alter table public.vehicle_loans enable row level security;
revoke all on table public.vehicle_loans from anon, authenticated;
grant select, delete on table public.vehicle_loans to authenticated;
grant insert (group_id, license_plate, model, destination, handed_to, handed_out_at, odometer_out, note)
  on table public.vehicle_loans to authenticated;
grant update (
  group_id, license_plate, model, destination, handed_to, handed_out_at, odometer_out, note,
  returned_at, odometer_in, was_used, return_note
) on table public.vehicle_loans to authenticated;
grant all on table public.vehicle_loans to service_role;
drop policy if exists vehicle_loans_select on public.vehicle_loans;
create policy vehicle_loans_select on public.vehicle_loans for select to authenticated
  using ((select private.current_employee_id()) is not null);
drop policy if exists vehicle_loans_insert on public.vehicle_loans;
create policy vehicle_loans_insert on public.vehicle_loans for insert to authenticated
  with check (
    (select private.current_employee_id()) is not null
    and handed_out_by = (select private.current_employee_id())
    and returned_at is null
  );
drop policy if exists vehicle_loans_update on public.vehicle_loans;
create policy vehicle_loans_update on public.vehicle_loans for update to authenticated
  using ((select private.is_lead())) with check ((select private.is_lead()));
drop policy if exists vehicle_loans_delete on public.vehicle_loans;
create policy vehicle_loans_delete on public.vehicle_loans for delete to authenticated
  using ((select private.is_lead()));
