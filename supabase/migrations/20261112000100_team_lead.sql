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
