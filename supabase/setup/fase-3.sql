-- =====================================================================
-- Planbord · Fase 3: mails, export en volledig verwijderen
--
-- Draai eerst fase-1.sql en fase-2.sql. Deze bundel voegt een tabel, een instelling en functies toe; de app van fase 2 merkt er niets van.
--
-- Plak dit hele bestand in Supabase: SQL Editor → New query → Run.
-- Het is veilig om opnieuw te draaien: bestaande tabellen en gegevens blijven staan.
--
-- Gegenereerd met `npm run db:bundle` uit supabase/migrations. Niet met de hand aanpassen.
-- =====================================================================

begin;
-- ---------------------------------------------------------------------
-- 20261003000100_mail_queue.sql
-- ---------------------------------------------------------------------

-- Planbord · fase 3 · 01 wachtrij voor mails
-- Elke mail staat eerst hier, en wordt dan verstuurd. Geen adressen en geen tekst: alleen voor
-- wie, over welke dag(en), welk soort mail en de status. De tekst ontstaat pas bij het versturen.

create table if not exists public.mail_queue (
  id uuid primary key default gen_random_uuid(),
  -- De ontvanger. Verdwijnt mee als de medewerker volledig wordt verwijderd.
  employee_id uuid not null references public.employees (id) on delete cascade,
  -- substitution_assigned = ingezet als invaller; substitution_cancelled = inval gaat niet door;
  -- day_changed = rooster voor één dag gewijzigd; reminder = herinnering de dag ervoor; test = testmail.
  kind text not null,
  dates date[] not null default '{}',
  -- pending = nog versturen; sent = verstuurd; failed = mislukt; skipped = niet verstuurd (mails uit, of geen werkmail).
  status text not null default 'pending',
  attempts smallint not null default 0,
  -- Een korte foutcode, zonder adres of inhoud.
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sent_at timestamptz,
  constraint mail_queue_kind check (
    kind in ('substitution_assigned', 'substitution_cancelled', 'day_changed', 'reminder', 'test')
  ),
  constraint mail_queue_status check (status in ('pending', 'sent', 'failed', 'skipped')),
  constraint mail_queue_dates check (
    cardinality(dates) <= 100
    and (kind <> 'reminder' or cardinality(dates) = 1)
    and (kind = 'test' or cardinality(dates) >= 1)
  ),
  constraint mail_queue_attempts check (attempts between 0 and 10),
  constraint mail_queue_error check (last_error is null or char_length(last_error) <= 100),
  constraint mail_queue_sent check ((status = 'sent') = (sent_at is not null))
);
-- Een herinnering gaat per persoon per dag hooguit één keer weg.
create unique index if not exists mail_queue_one_reminder_per_day
  on public.mail_queue (employee_id, (dates[1])) where kind = 'reminder';
create index if not exists mail_queue_created_idx on public.mail_queue (created_at desc);
create index if not exists mail_queue_open_idx on public.mail_queue (created_at) where status in ('pending', 'failed');
create or replace trigger set_updated_at before update on public.mail_queue
  for each row execute function private.set_updated_at();

-- Alleen beheerders. De geplande taak gebruikt de secret key (service_role).
-- Geen delete voor ingelogde gebruikers: opruimen doet alleen de server.
alter table public.mail_queue enable row level security;
revoke all on table public.mail_queue from anon, authenticated;
grant select on table public.mail_queue to authenticated;
grant insert (employee_id, kind, dates, status, last_error) on table public.mail_queue to authenticated;
grant update (status, attempts, last_error, sent_at) on table public.mail_queue to authenticated;
grant all on table public.mail_queue to service_role;
drop policy if exists mail_queue_select on public.mail_queue;
create policy mail_queue_select on public.mail_queue for select to authenticated
  using ((select private.is_admin()));
drop policy if exists mail_queue_insert on public.mail_queue;
create policy mail_queue_insert on public.mail_queue for insert to authenticated
  with check ((select private.is_admin()));
drop policy if exists mail_queue_update on public.mail_queue;
create policy mail_queue_update on public.mail_queue for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

-- ---------------------------------------------------------------------
-- 20261003000200_settings_mail.sql
-- ---------------------------------------------------------------------

-- Planbord · fase 3 · 02 schakelaar "Mails versturen" (besluit V18)
-- Na de installatie staat hij uit. Zolang hij uit staat, gaat er geen mail naar collega's.

alter table public.settings add column if not exists mail_enabled boolean not null default false;
grant update (mail_enabled) on table public.settings to authenticated;

-- Het logboek legt het aan- en uitzetten vast, met de waarde.
create or replace trigger audit after insert or update or delete on public.settings
  for each row execute function private.audit_row(
    'standard_shift_start', 'standard_shift_end', 'saturday_shift_start', 'saturday_shift_end',
    'day_part_boundary', 'lookahead_weeks', 'mail_enabled'
  );

-- ---------------------------------------------------------------------
-- 20261003000300_rpc_phase3.sql
-- ---------------------------------------------------------------------

-- Planbord · fase 3 · 03 volledig verwijderen en export in het logboek

-- Het logboek, zoals in fase 1, met één uitzondering: bij volledig verwijderen (besluit V21)
-- logt delete_employee zelf één regel met de aantallen. De rijen die daarbij via de cascade
-- verdwijnen, krijgen geen eigen regel: dat zou de gegevens van de verwijderde persoon
-- alsnog in het logboek bewaren.
create or replace function private.audit_row()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  old_row jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  new_row jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;
  row_data jsonb := coalesce(new_row, old_row);
  changed text[];
  detail jsonb;
  actor uuid := auth.uid();
  actor_employee uuid;
  subject uuid;
begin
  if nullif(current_setting('app.audit_source', true), '') = 'verwijderen' then
    return null;
  end if;

  if tg_op = 'UPDATE' then
    select coalesce(array_agg(n.key order by n.key), '{}')
      into changed
      from jsonb_each(new_row) as n(key, value)
     where n.key not in ('created_at', 'updated_at')
       and n.value is distinct from old_row -> n.key;
    -- Niets veranderd: niets loggen.
    if cardinality(changed) = 0 then
      return null;
    end if;
    select jsonb_object_agg(k, jsonb_build_object('old', old_row -> k, 'new', new_row -> k))
      into detail
      from unnest(changed) as k
     where k = any (tg_argv);
  else
    select jsonb_object_agg(k, row_data -> k)
      into detail
      from unnest(tg_argv) as k
     where row_data ? k;
  end if;

  if actor is not null then
    select a.employee_id into actor_employee from public.employee_accounts a where a.user_id = actor;
  end if;

  if tg_table_name = 'employees' then
    subject := (row_data ->> 'id')::uuid;
  elsif row_data ? 'employee_id' then
    subject := (row_data ->> 'employee_id')::uuid;
  end if;

  insert into public.audit_log (
    actor_user_id, actor_employee_id, action, entity, entity_id, employee_id, changed_fields, details, source
  ) values (
    actor, actor_employee, lower(tg_op), tg_table_name, row_data ->> 'id', subject, changed, detail,
    nullif(current_setting('app.audit_source', true), '')
  );

  delete from public.audit_log where occurred_at < now() - interval '12 months';
  return null;
end;
$$;
revoke all on function private.audit_row() from public, anon, authenticated;

-- Een medewerker volledig verwijderen (besluit V21). Het inlogaccount verwijdert de app vooraf
-- met de secret key. Alleen een beheerder, alleen bij een inactieve medewerker, en niet jezelf.
-- De rest verdwijnt via de bestaande `on delete cascade`. Geeft de aantallen terug.
create or replace function public.delete_employee(p_employee_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.employees%rowtype;
  actor uuid := auth.uid();
  actor_employee uuid;
  counts jsonb;
begin
  if not private.is_admin() then
    raise exception 'Alleen een beheerder kan een medewerker verwijderen.' using errcode = '42501';
  end if;
  select * into target from public.employees where id = p_employee_id for update;
  if not found then
    raise exception 'Deze medewerker bestaat niet meer.' using errcode = 'P0002';
  end if;
  select a.employee_id into actor_employee from public.employee_accounts a where a.user_id = actor;
  if actor_employee = p_employee_id then
    raise exception 'Je kunt jezelf niet verwijderen.' using errcode = 'P0001';
  end if;
  if target.is_active then
    raise exception 'Zet de medewerker eerst op inactief.' using errcode = 'P0001';
  end if;

  counts := jsonb_build_object(
    'recurring_shifts', (select count(*) from public.recurring_shifts where employee_id = p_employee_id),
    'absences', (select count(*) from public.absences where employee_id = p_employee_id),
    'substitutions', (select count(*) from public.substitutions where employee_id = p_employee_id),
    'shift_overrides', (select count(*) from public.shift_overrides where employee_id = p_employee_id),
    'calendar_feeds', (select count(*) from public.calendar_feeds where employee_id = p_employee_id),
    'account', exists (select 1 from public.employee_accounts where employee_id = p_employee_id)
  );

  perform set_config('app.audit_source', 'verwijderen', true);
  delete from public.employees where id = p_employee_id;
  insert into public.audit_log (
    actor_user_id, actor_employee_id, action, entity, entity_id, employee_id, details, source
  ) values (
    actor, actor_employee, 'delete', 'employees', p_employee_id::text, p_employee_id, counts, 'verwijderen'
  );
  perform set_config('app.audit_source', '', true);
  return counts;
end;
$$;
revoke all on function public.delete_employee(uuid) from public, anon, authenticated;
grant execute on function public.delete_employee(uuid) to authenticated;

-- Een export in het logboek (besluit V20): wie, wanneer en welke. 'planning' of 'employee'.
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
  if not private.is_admin() then
    raise exception 'Alleen een beheerder kan exporteren.' using errcode = '42501';
  end if;
  if p_kind is null or p_kind not in ('planning', 'employee') then
    raise exception 'Onbekende export.' using errcode = '22023';
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
