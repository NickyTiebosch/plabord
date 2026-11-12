-- =====================================================================
-- Planbord · Fase 5: de rol teamleider en de uitleen
--
-- Draai eerst fase-1.sql tot en met fase-4.sql. Deze bundel voegt een tabel, twee kolommen en functies toe, en geeft de teamleider rechten op afwezigheid en invallen; de app van fase 4 merkt er niets van.
--
-- Plak dit hele bestand in Supabase: SQL Editor → New query → Run.
-- Het is veilig om opnieuw te draaien: bestaande tabellen en gegevens blijven staan.
--
-- Gegenereerd met `npm run db:bundle` uit supabase/migrations. Niet met de hand aanpassen.
-- =====================================================================

begin;
-- ---------------------------------------------------------------------
-- 20261112000100_team_lead.sql
-- ---------------------------------------------------------------------

-- Planbord · fase 5 · 01 de rol teamleider (besluit V43)
-- Een teamleider helpt de beheerder: afwezigheid invoeren, wijzigen en goedkeuren, en gaten regelen
-- (invallen, schuiven, zelf inspringen, negeren, roosterwijzigingen voor één dag). Medewerkers,
-- accounts, vaste diensten, sluitingsdagen, normen en instellingen blijven bij de beheerder.
-- Een beheerder kan alles wat een teamleider kan. Alleen een beheerder maakt iemand teamleider.

alter table public.employees add column if not exists is_team_lead boolean not null default false;
grant insert (is_team_lead), update (is_team_lead) on table public.employees to authenticated;

-- Beheerder of teamleider, en actief.
create or replace function private.is_lead()
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
    where a.user_id = auth.uid() and e.is_active and (e.is_admin or e.is_team_lead)
  )
$$;
revoke all on function private.is_lead() from public, anon, authenticated;
grant execute on function private.is_lead() to authenticated, service_role;

-- Het logboek legt vast wie teamleider wordt of af is.
create or replace trigger audit after insert or update or delete on public.employees
  for each row execute function private.audit_row('group_id', 'default_role', 'is_admin', 'is_active', 'is_team_lead');

-- Afwezigheid: lezen blijft voor iedereen; schrijven voor beheerder en teamleider.
drop policy if exists absences_insert on public.absences;
create policy absences_insert on public.absences for insert to authenticated
  with check ((select private.is_lead()));
drop policy if exists absences_update on public.absences;
create policy absences_update on public.absences for update to authenticated
  using ((select private.is_lead())) with check ((select private.is_lead()));
drop policy if exists absences_delete on public.absences;
create policy absences_delete on public.absences for delete to authenticated
  using ((select private.is_lead()));

-- Invallen.
drop policy if exists substitutions_insert on public.substitutions;
create policy substitutions_insert on public.substitutions for insert to authenticated
  with check ((select private.is_lead()));
drop policy if exists substitutions_update on public.substitutions;
create policy substitutions_update on public.substitutions for update to authenticated
  using ((select private.is_lead())) with check ((select private.is_lead()));

-- Roosterwijzigingen voor één dag (ook zelf inspringen). Vaste diensten blijven bij de beheerder.
drop policy if exists shift_overrides_insert on public.shift_overrides;
create policy shift_overrides_insert on public.shift_overrides for insert to authenticated
  with check ((select private.is_lead()));
drop policy if exists shift_overrides_update on public.shift_overrides;
create policy shift_overrides_update on public.shift_overrides for update to authenticated
  using ((select private.is_lead())) with check ((select private.is_lead()));
drop policy if exists shift_overrides_delete on public.shift_overrides;
create policy shift_overrides_delete on public.shift_overrides for delete to authenticated
  using ((select private.is_lead()));

-- Genegeerde gaten: zien en negeren.
drop policy if exists gap_dismissals_select on public.gap_dismissals;
create policy gap_dismissals_select on public.gap_dismissals for select to authenticated
  using ((select private.is_lead()));
drop policy if exists gap_dismissals_insert on public.gap_dismissals;
create policy gap_dismissals_insert on public.gap_dismissals for insert to authenticated
  with check ((select private.is_lead()));
drop policy if exists gap_dismissals_update on public.gap_dismissals;
create policy gap_dismissals_update on public.gap_dismissals for update to authenticated
  using ((select private.is_lead())) with check ((select private.is_lead()));
drop policy if exists gap_dismissals_delete on public.gap_dismissals;
create policy gap_dismissals_delete on public.gap_dismissals for delete to authenticated
  using ((select private.is_lead()));

-- De wachtrij voor mails: een teamleider ziet de stand bij "Let op" (geen adressen en geen tekst).
-- Klaarzetten en bijwerken blijft voor beheerders. De mails na een actie van een teamleider zet de
-- server klaar met de secret key: een teamleider mag de werkmails van collega's niet lezen.
drop policy if exists mail_queue_select on public.mail_queue;
create policy mail_queue_select on public.mail_queue for select to authenticated
  using ((select private.is_lead()));

-- De controle op achterhaalde invallen (besluit V10), nu ook voor de teamleider.
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
  if not private.is_lead() then
    raise exception 'Alleen een beheerder of teamleider kan invallen wijzigen.' using errcode = '42501';
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

-- ---------------------------------------------------------------------
-- 20261112000200_vehicle_loans.sql
-- ---------------------------------------------------------------------

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

-- ---------------------------------------------------------------------
-- 20261112000300_rpc_phase5.sql
-- ---------------------------------------------------------------------

-- Planbord · fase 5 · 03 functies voor de uitleen, en de export van de uitleen in het logboek

-- Retour melden (V47): ingezet of niet ingezet. Iedere actieve medewerker, ook voor een auto die
-- een collega aanmeldde. Alleen de retourvelden veranderen, en alleen als de auto nog uit staat.
-- Zonder tijdstip geldt nu. Geeft het aantal gewijzigde regels terug: 0 = al retour of verdwenen.
create or replace function public.return_vehicle_loan(
  p_id uuid,
  p_was_used boolean,
  p_odometer_in integer default null,
  p_note text default null,
  p_returned_at timestamptz default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := private.current_employee_id();
  moment timestamptz := coalesce(p_returned_at, now());
  affected integer;
begin
  if me is null then
    raise exception 'Alleen een actieve medewerker kan een auto retour melden.' using errcode = '42501';
  end if;
  if p_was_used is null then
    raise exception 'Kies of de auto is ingezet.' using errcode = '22023';
  end if;
  if moment > now() + interval '5 minutes' then
    raise exception 'Het tijdstip van retour ligt in de toekomst.' using errcode = '22023';
  end if;
  update public.vehicle_loans
     set returned_at = moment,
         returned_by = me,
         was_used = p_was_used,
         odometer_in = p_odometer_in,
         return_note = nullif(btrim(coalesce(p_note, '')), '')
   where id = p_id
     and returned_at is null;
  get diagnostics affected = row_count;
  return affected;
end;
$$;
revoke all on function public.return_vehicle_loan(uuid, boolean, integer, text, timestamptz) from public, anon, authenticated;
grant execute on function public.return_vehicle_loan(uuid, boolean, integer, text, timestamptz) to authenticated;

-- Retour ongedaan maken (V47): wie retour meldde, op dezelfde dag (Nederlandse tijd); daarna alleen
-- een beheerder of teamleider. De auto staat daarna weer uit. Staat dezelfde auto intussen opnieuw
-- uit, dan kan het niet: een auto staat maar één keer tegelijk uit.
create or replace function public.undo_vehicle_loan_return(p_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := private.current_employee_id();
  loan public.vehicle_loans%rowtype;
  affected integer;
begin
  if me is null then
    raise exception 'Alleen een actieve medewerker kan dit.' using errcode = '42501';
  end if;
  select * into loan from public.vehicle_loans where id = p_id for update;
  if not found or loan.returned_at is null then
    return 0;
  end if;
  if not private.is_lead()
     and not (
       loan.returned_by = me
       and (loan.returned_at at time zone 'Europe/Amsterdam')::date = (now() at time zone 'Europe/Amsterdam')::date
     ) then
    raise exception 'Alleen wie de auto retour meldde kan dat vandaag ongedaan maken. Vraag het anders je teamleider.'
      using errcode = '42501';
  end if;
  update public.vehicle_loans
     set returned_at = null,
         returned_by = null,
         was_used = null,
         odometer_in = null,
         return_note = null
   where id = p_id;
  get diagnostics affected = row_count;
  return affected;
end;
$$;
revoke all on function public.undo_vehicle_loan_return(uuid) from public, anon, authenticated;
grant execute on function public.undo_vehicle_loan_return(uuid) to authenticated;

-- Een export in het logboek (besluit V20): wie, wanneer en welke. Nieuw in fase 5: 'loans', de
-- uitleen (V50), voor beheerder en teamleider. De planning en de gegevens van één medewerker
-- blijven alleen voor de beheerder.
create or replace function public.log_export(p_kind text, p_employee_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  actor_employee uuid;
begin
  if p_kind is null or p_kind not in ('planning', 'employee', 'loans') then
    raise exception 'Onbekende export.' using errcode = '22023';
  end if;
  if p_kind = 'loans' then
    if not private.is_lead() then
      raise exception 'Alleen een beheerder of teamleider kan de uitleen exporteren.' using errcode = '42501';
    end if;
  elsif not private.is_admin() then
    raise exception 'Alleen een beheerder kan exporteren.' using errcode = '42501';
  end if;
  if p_kind = 'employee' and p_employee_id is null then
    raise exception 'Kies een medewerker voor deze export.' using errcode = '22023';
  end if;
  select a.employee_id into actor_employee from public.employee_accounts a where a.user_id = actor;
  insert into public.audit_log (actor_user_id, actor_employee_id, action, entity, employee_id, details)
  values (
    actor, actor_employee, 'insert', 'export',
    case when p_kind = 'employee' then p_employee_id end,
    jsonb_build_object('kind', p_kind)
  );
end;
$$;
revoke all on function public.log_export(text, uuid) from public, anon, authenticated;
grant execute on function public.log_export(text, uuid) to authenticated;

commit;
