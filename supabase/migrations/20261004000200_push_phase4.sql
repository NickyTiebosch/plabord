-- Planbord · fase 4 · 02 push bij de mails, en de toestellen bij volledig verwijderen

-- Bij elke mail: naar hoeveel toestellen de push ging (V24). Geen adressen of tekst.
alter table public.mail_queue add column if not exists push_devices smallint not null default 0;
alter table public.mail_queue drop constraint if exists mail_queue_push_devices;
alter table public.mail_queue add constraint mail_queue_push_devices check (push_devices between 0 and 100);
grant update (push_devices) on table public.mail_queue to authenticated;

-- Een medewerker volledig verwijderen (besluit V21), zoals in fase 3. Nieuw: de aantallen noemen ook
-- de toestellen met meldingen (fase 4, V28); die verdwijnen via de cascade. Het inlogaccount
-- verwijdert de app vooraf met de secret key. Alleen een beheerder, alleen bij een inactieve
-- medewerker, en niet jezelf. Geeft de aantallen terug.
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
    'push_subscriptions', (select count(*) from public.push_subscriptions where employee_id = p_employee_id),
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
