-- Planbord · fase 6 · 01 binnenvallers, meldingen en dag afsluiten (besluiten V55–V65)
-- Alleen wat de registratie nodig heeft: aantallen, kentekens en contractnummers. Geen klantnamen
-- of andere klantgegevens. Het logboek bewaart geen vrije tekst.

-- Instellingen: vanaf wanneer een annulering wordt doorbelast (V58), en wanneer de herinnering
-- voor het afsluiten van de dag gaat (V61). Leeg = geen herinnering.
alter table public.settings add column if not exists charge_cancellation_from time not null default '11:00';
alter table public.settings add column if not exists day_close_reminder_at time default '16:00';
grant update (charge_cancellation_from, day_close_reminder_at) on table public.settings to authenticated;

-- Werkplaatsen per vestiging (V56).
create table if not exists public.workshops (
  id uuid primary key default gen_random_uuid(),
  group_id text not null,
  has_counter boolean not null default true,
  name text not null,
  sort_order smallint not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workshops_counter_only check (has_counter),
  constraint workshops_group_fkey foreign key (group_id, has_counter)
    references public.groups (id, has_counter) on update cascade,
  constraint workshops_name_format check (name = btrim(name) and char_length(name) between 1 and 40),
  constraint workshops_name_key unique (group_id, name),
  -- Voor de verwijzingen hieronder: een cijfer hoort bij een werkplaats van dezelfde vestiging.
  constraint workshops_id_group_key unique (id, group_id)
);
create or replace trigger set_updated_at before update on public.workshops
  for each row execute function private.set_updated_at();
create or replace trigger audit after insert or update or delete on public.workshops
  for each row execute function private.audit_row('group_id', 'name', 'sort_order', 'is_active');

alter table public.workshops enable row level security;
revoke all on table public.workshops from anon, authenticated;
grant select, delete on table public.workshops to authenticated;
grant insert (group_id, name, sort_order, is_active), update (name, sort_order, is_active) on table public.workshops to authenticated;
grant all on table public.workshops to service_role;
drop policy if exists workshops_select on public.workshops;
create policy workshops_select on public.workshops for select to authenticated
  using ((select private.current_employee_id()) is not null);
drop policy if exists workshops_insert on public.workshops;
create policy workshops_insert on public.workshops for insert to authenticated
  with check ((select private.is_admin()));
drop policy if exists workshops_update on public.workshops;
create policy workshops_update on public.workshops for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
drop policy if exists workshops_delete on public.workshops;
create policy workshops_delete on public.workshops for delete to authenticated
  using ((select private.is_admin()));

-- De werkplaatsen uit de huidige Excel-bestanden. Alleen bij een lege tabel: daarna beheert de
-- beheerder de lijst, en zet de setup niets terug.
do $$
begin
  if not exists (select 1 from public.workshops) then
    perform set_config('app.audit_source', 'setup', true);
    insert into public.workshops (group_id, name, sort_order)
    select w.g, w.n, w.o
    from (values
      ('den_bosch', 'Volkswagen', 1), ('den_bosch', 'Audi', 2), ('den_bosch', 'Bedrijfswagens', 3), ('den_bosch', 'Seat Skoda', 4),
      ('den_bosch', 'Oss', 5), ('den_bosch', 'Carlux Den Bosch', 6), ('den_bosch', 'Carlux Oss', 7),
      ('eindhoven', 'Volkswagen', 1), ('eindhoven', 'Audi', 2), ('eindhoven', 'Veldhoven', 3), ('eindhoven', 'Bedrijfswagens', 4),
      ('eindhoven', 'Carlux Best', 5),
      ('breda', 'Volkswagen', 1), ('breda', 'Audi', 2), ('breda', 'Bedrijfswagens', 3), ('breda', 'Seat Skoda', 4),
      ('breda', 'Roosendaal', 5), ('breda', 'Halsteren', 6), ('breda', 'Den Elzen Breda', 7), ('breda', 'Den Elzen Roosendaal', 8)
    ) as w(g, n, o)
    where exists (select 1 from public.groups g where g.id = w.g and g.has_counter);
    perform set_config('app.audit_source', '', true);
  end if;
end;
$$;

-- Binnenvallers (V57): per vestiging, werkplaats en dag één aantal.
create table if not exists public.walk_ins (
  group_id text not null,
  workshop_id uuid not null,
  date date not null,
  count smallint not null default 0,
  updated_by uuid references public.employees (id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (workshop_id, date),
  constraint walk_ins_workshop_fkey foreign key (workshop_id, group_id)
    references public.workshops (id, group_id) on delete restrict,
  constraint walk_ins_count_range check (count between 0 and 500),
  constraint walk_ins_date_bounds check (date >= date '2020-01-01' and date < date '2100-01-01')
);
create index if not exists walk_ins_group_date_idx on public.walk_ins (group_id, date);
create or replace trigger audit after insert or update or delete on public.walk_ins
  for each row execute function private.audit_row('group_id', 'workshop_id', 'date', 'count');

-- Schrijven gaat alleen via de functies hieronder: zo overschrijven twee collega's elkaars tik niet.
alter table public.walk_ins enable row level security;
revoke all on table public.walk_ins from anon, authenticated;
grant select on table public.walk_ins to authenticated;
grant all on table public.walk_ins to service_role;
drop policy if exists walk_ins_select on public.walk_ins;
create policy walk_ins_select on public.walk_ins for select to authenticated
  using ((select private.current_employee_id()) is not null);

-- Meldingen (V58): één regel per melding van een werkplaats.
create table if not exists public.incident_reports (
  id uuid primary key default gen_random_uuid(),
  group_id text not null,
  workshop_id uuid not null,
  occurred_at timestamptz not null default now(),
  -- contract_license = contract of rijbewijs niet in orde; wrong_vehicle = verkeerde auto meegegeven;
  -- cancellation = annulering door de werkplaats; late_return = te laat retour.
  kind text not null,
  -- Alleen bij contract_license: signature, license_check of both.
  missing text,
  -- Alleen bij een annulering: het tijdstip waarop de werkplaats annuleerde, en of het doorbelast wordt.
  cancelled_at time,
  charge boolean,
  -- Is het ook echt doorbelast (V62)? Door wie en wanneer.
  charged_at timestamptz,
  charged_by uuid references public.employees (id) on delete set null,
  license_plate text,
  contract_number text,
  note text,
  reported_by uuid references public.employees (id) on delete set null,
  -- Ingelezen uit het oude Excel-bestand (V63): voorkomt dubbele regels bij opnieuw inlezen.
  import_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint incident_reports_workshop_fkey foreign key (workshop_id, group_id)
    references public.workshops (id, group_id) on delete restrict,
  constraint incident_reports_kind check (kind in ('contract_license', 'wrong_vehicle', 'cancellation', 'late_return')),
  constraint incident_reports_missing check (
    (kind = 'contract_license' and (missing is null or missing in ('signature', 'license_check', 'both')))
    or (kind <> 'contract_license' and missing is null)
  ),
  constraint incident_reports_cancellation_shape check (
    (kind = 'cancellation' and charge is not null) or (kind <> 'cancellation' and cancelled_at is null and charge is null)
  ),
  constraint incident_reports_charged_shape check (
    (charged_at is null and charged_by is null) or (charged_at is not null and charge is true)
  ),
  constraint incident_reports_plate_format check (license_plate is null or license_plate ~ '^[A-Z0-9]{2,10}$'),
  constraint incident_reports_contract_format check (
    contract_number is null or (contract_number = btrim(contract_number) and char_length(contract_number) between 1 and 20)
  ),
  constraint incident_reports_note_format check (note is null or (note = btrim(note) and char_length(note) between 1 and 300)),
  constraint incident_reports_moment_bounds check (
    occurred_at >= timestamptz '2020-01-01 00:00:00+00' and occurred_at < timestamptz '2100-01-01 00:00:00+00'
  ),
  constraint incident_reports_import_key unique (import_key)
);
create index if not exists incident_reports_group_idx on public.incident_reports (group_id, occurred_at desc);
create index if not exists incident_reports_charge_idx on public.incident_reports (occurred_at desc) where charge;
create or replace trigger set_updated_at before update on public.incident_reports
  for each row execute function private.set_updated_at();

-- Melden gaat altijd op eigen naam. Alleen bij het inlezen van de historie (import_registrations)
-- blijft staan wie het oude bestand noemde.
create or replace function private.set_incident_reporter()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null and current_setting('app.audit_source', true) is distinct from 'import' then
    new.reported_by := private.current_employee_id();
  end if;
  return new;
end;
$$;
revoke all on function private.set_incident_reporter() from public, anon, authenticated;
create or replace trigger set_reporter before insert on public.incident_reports
  for each row execute function private.set_incident_reporter();

-- Bewaren (V65): 24 maanden na de datum verdwijnt een melding, bij de volgende nieuwe melding.
create or replace function private.clean_incident_reports()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  previous text := current_setting('app.audit_source', true);
begin
  if exists (select 1 from public.incident_reports where occurred_at < now() - interval '24 months') then
    perform set_config('app.audit_source', 'opruimen', true);
    delete from public.incident_reports where occurred_at < now() - interval '24 months';
    perform set_config('app.audit_source', coalesce(previous, ''), true);
  end if;
  return null;
end;
$$;
revoke all on function private.clean_incident_reports() from public, anon, authenticated;
create or replace trigger clean_old after insert on public.incident_reports
  for each statement execute function private.clean_incident_reports();

-- Het logboek: geen bijzonderheden. Wel soort, werkplaats, kenteken, contractnummer en doorbelasten.
create or replace trigger audit after insert or update or delete on public.incident_reports
  for each row execute function private.audit_row(
    'group_id', 'workshop_id', 'occurred_at', 'kind', 'missing', 'cancelled_at', 'charge', 'charged_at',
    'license_plate', 'contract_number'
  );

-- Wie de melding maakte, kan haar op dezelfde dag (Nederlandse tijd) zelf wijzigen of verwijderen
-- (V59); daarna en bij meldingen van een ander: beheerder of teamleider.
create or replace function private.owns_incident_today(p_reported_by uuid, p_created_at timestamptz)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_reported_by is not null
     and p_reported_by = private.current_employee_id()
     and (p_created_at at time zone 'Europe/Amsterdam')::date = (now() at time zone 'Europe/Amsterdam')::date
$$;
revoke all on function private.owns_incident_today(uuid, timestamptz) from public, anon, authenticated;
grant execute on function private.owns_incident_today(uuid, timestamptz) to authenticated, service_role;

alter table public.incident_reports enable row level security;
revoke all on table public.incident_reports from anon, authenticated;
grant select, delete on table public.incident_reports to authenticated;
grant insert (group_id, workshop_id, occurred_at, kind, missing, cancelled_at, charge, license_plate, contract_number, note)
  on table public.incident_reports to authenticated;
grant update (group_id, workshop_id, occurred_at, kind, missing, cancelled_at, charge, license_plate, contract_number, note)
  on table public.incident_reports to authenticated;
grant all on table public.incident_reports to service_role;
drop policy if exists incident_reports_select on public.incident_reports;
create policy incident_reports_select on public.incident_reports for select to authenticated
  using ((select private.current_employee_id()) is not null);
drop policy if exists incident_reports_insert on public.incident_reports;
create policy incident_reports_insert on public.incident_reports for insert to authenticated
  with check (
    (select private.current_employee_id()) is not null
    and reported_by = (select private.current_employee_id())
    and charged_at is null
  );
drop policy if exists incident_reports_update on public.incident_reports;
create policy incident_reports_update on public.incident_reports for update to authenticated
  using ((select private.is_lead()) or private.owns_incident_today(reported_by, created_at))
  with check ((select private.is_lead()) or private.owns_incident_today(reported_by, created_at));
drop policy if exists incident_reports_delete on public.incident_reports;
create policy incident_reports_delete on public.incident_reports for delete to authenticated
  using ((select private.is_lead()) or private.owns_incident_today(reported_by, created_at));

-- Dag afsluiten (V60): per vestiging en dag, met het vinkje dat RentLink is gecontroleerd.
create table if not exists public.day_closures (
  group_id text not null,
  has_counter boolean not null default true,
  date date not null,
  rentlink_checked boolean not null default false,
  closed_by uuid references public.employees (id) on delete set null,
  closed_at timestamptz not null default now(),
  primary key (group_id, date),
  constraint day_closures_counter_only check (has_counter),
  constraint day_closures_group_fkey foreign key (group_id, has_counter)
    references public.groups (id, has_counter) on update cascade,
  constraint day_closures_date_bounds check (date >= date '2020-01-01' and date < date '2100-01-01')
);
create or replace trigger audit after insert or update or delete on public.day_closures
  for each row execute function private.audit_row('group_id', 'date', 'rentlink_checked');

alter table public.day_closures enable row level security;
revoke all on table public.day_closures from anon, authenticated;
grant select on table public.day_closures to authenticated;
grant all on table public.day_closures to service_role;
drop policy if exists day_closures_select on public.day_closures;
create policy day_closures_select on public.day_closures for select to authenticated
  using ((select private.current_employee_id()) is not null);
