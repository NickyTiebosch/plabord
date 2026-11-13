-- Planbord · fase 5 · 05 Mobiliteit voor iedere vestiging (besluit V54, vervangt V52)
-- Iedere collega ziet het onderdeel Mobiliteit weer, en iedere vestiging met een balie kan auto's
-- meegeven. De beperking uit 04 vervalt: de rechten zijn weer zoals in 02. Een nieuwe migratie in
-- plaats van 04 aanpassen, omdat 04 al in het testproject kan staan.

-- Lezen en aanmelden: weer iedere actieve medewerker.
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

-- De controle per vestiging uit 04 vervalt. Dat een auto bij een vestiging met een balie hoort,
-- dwingt de verwijzing naar groups (id, has_counter) uit 02 al af.
drop trigger if exists check_loan on public.vehicle_loans;
drop function if exists private.check_vehicle_loan();
drop function if exists public.uses_loans();
drop function if exists private.uses_loans();

-- De instelling "leent uit" vervalt; het logboek volgt weer de velden uit 02.
create or replace trigger audit after insert or update or delete on public.groups
  for each row execute function private.audit_row(
    'name', 'has_counter', 'sort_order', 'substitution_rank', 'mobility_loans_per_day'
  );
alter table public.groups drop column if exists lends_vehicles;
