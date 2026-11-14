-- Planbord · fase 8 · 02 overdracht per vestiging (routekaart fase 8, op verzoek van de eigenaar op 14 november 2026)
--
-- Een korte notitie voor de collega van morgen. Na 7 dagen verdwijnt hij vanzelf. Zonder
-- klantgegevens. Het logboek bewaart de tekst niet.

create table if not exists public.handover_notes (
  id uuid primary key default gen_random_uuid(),
  group_id text not null,
  has_counter boolean not null default true,
  body text not null,
  created_by uuid references public.employees (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint handover_notes_counter_only check (has_counter),
  constraint handover_notes_group_fkey foreign key (group_id, has_counter)
    references public.groups (id, has_counter) on update cascade,
  constraint handover_notes_body_format check (body = btrim(body) and char_length(body) between 1 and 300)
);
create index if not exists handover_notes_group_idx on public.handover_notes (group_id, created_at desc);

-- Wie de notitie schrijft, vult de database in.
create or replace function private.set_handover_author()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null then
    new.created_by := private.current_employee_id();
  end if;
  return new;
end;
$$;
revoke all on function private.set_handover_author() from public, anon, authenticated;
create or replace trigger set_author before insert on public.handover_notes
  for each row execute function private.set_handover_author();

create or replace function private.touch_handover_note()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function private.touch_handover_note() from public, anon, authenticated;
create or replace trigger touch before update on public.handover_notes
  for each row execute function private.touch_handover_note();

-- Het logboek: wie, wanneer en welke vestiging. Niet de tekst.
create or replace trigger audit after insert or update or delete on public.handover_notes
  for each row execute function private.audit_row('group_id');

-- Na 7 dagen weg, bij de volgende nieuwe notitie.
create or replace function private.clean_handover_notes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  previous text := current_setting('app.audit_source', true);
begin
  if exists (select 1 from public.handover_notes where created_at < now() - interval '7 days') then
    perform set_config('app.audit_source', 'opruimen', true);
    delete from public.handover_notes where created_at < now() - interval '7 days';
    perform set_config('app.audit_source', coalesce(previous, ''), true);
  end if;
  return null;
end;
$$;
revoke all on function private.clean_handover_notes() from public, anon, authenticated;
create or replace trigger clean_old after insert on public.handover_notes
  for each statement execute function private.clean_handover_notes();

alter table public.handover_notes enable row level security;
revoke all on table public.handover_notes from anon, authenticated;
grant select, delete on table public.handover_notes to authenticated;
grant insert (group_id, body), update (body) on table public.handover_notes to authenticated;
grant all on table public.handover_notes to service_role;
drop policy if exists handover_notes_select on public.handover_notes;
create policy handover_notes_select on public.handover_notes for select to authenticated
  using ((select private.current_employee_id()) is not null and created_at >= now() - interval '7 days');
drop policy if exists handover_notes_insert on public.handover_notes;
create policy handover_notes_insert on public.handover_notes for insert to authenticated
  with check ((select private.current_employee_id()) is not null and created_by = (select private.current_employee_id()));
-- Wie de notitie schreef, wijzigt of verwijdert hem op dezelfde dag; daarna de teamleider of beheerder (zoals V59).
drop policy if exists handover_notes_update on public.handover_notes;
create policy handover_notes_update on public.handover_notes for update to authenticated
  using ((select private.is_lead()) or private.owns_incident_today(created_by, created_at))
  with check ((select private.is_lead()) or private.owns_incident_today(created_by, created_at));
drop policy if exists handover_notes_delete on public.handover_notes;
create policy handover_notes_delete on public.handover_notes for delete to authenticated
  using ((select private.is_lead()) or private.owns_incident_today(created_by, created_at));

-- Exports: ook de overdracht, voor beheerder en teamleider.
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
  if p_kind is null or p_kind not in ('planning', 'employee', 'loans', 'walk_ins', 'incidents', 'reports', 'locations', 'handover') then
    raise exception 'Onbekende export.' using errcode = '22023';
  end if;
  if p_kind in ('loans', 'walk_ins', 'incidents', 'reports', 'locations', 'handover') then
    if not private.is_lead() then
      raise exception 'Alleen een beheerder of teamleider kan dit exporteren.' using errcode = '42501';
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
