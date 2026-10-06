-- =====================================================================
-- Planbord · Fase 4: pushmeldingen
--
-- Draai eerst fase-1.sql, fase-2.sql en fase-3.sql. Deze bundel voegt een tabel, een kolom en functies toe; de app van fase 3 merkt er niets van. Sinds de uitnodiging (V33) staat de soort mail 'invite' er ook in: draai de bundel dan opnieuw. Sinds V38 staat er ook een functie in waarmee beheerders zien wie er is ingelogd: draai de bundel dan opnieuw.
--
-- Plak dit hele bestand in Supabase: SQL Editor → New query → Run.
-- Het is veilig om opnieuw te draaien: bestaande tabellen en gegevens blijven staan.
--
-- Gegenereerd met `npm run db:bundle` uit supabase/migrations. Niet met de hand aanpassen.
-- =====================================================================

begin;
-- ---------------------------------------------------------------------
-- 20261004000100_push_subscriptions.sql
-- ---------------------------------------------------------------------

-- Planbord · fase 4 · 01 push-abonnementen (besluiten V25 en V28)
-- Per toestel met meldingen aan: het adres bij de pushdienst en de twee sleutels van het toestel.
-- Daarmee versleutelt de server elke melding voor dat ene toestel; de pushdienst kan hem niet lezen.

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  -- Van wie het toestel is. Verdwijnt mee als de medewerker volledig wordt verwijderd.
  employee_id uuid not null references public.employees (id) on delete cascade,
  -- Het adres bij de pushdienst. Alleen https-adressen van Apple, Google, Mozilla en Microsoft:
  -- zo kan niemand de server een ander adres laten aanroepen.
  endpoint text not null,
  -- De publieke sleutel (P-256, 65 bytes) en het geheim (16 bytes) van het toestel, base64url.
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now(),
  -- De laatste keer dat een push aankwam bij de pushdienst.
  last_success_at timestamptz,
  constraint push_subscriptions_endpoint_unique unique (endpoint),
  constraint push_subscriptions_endpoint_known check (
    char_length(endpoint) <= 1024
    and endpoint ~ '^https://(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|[a-z0-9-]+\.push\.apple\.com|[a-z0-9-]+\.notify\.windows\.com)/'
  ),
  constraint push_subscriptions_keys check (p256dh ~ '^[A-Za-z0-9_-]{86,88}$' and auth ~ '^[A-Za-z0-9_-]{22,24}$')
);
create index if not exists push_subscriptions_employee_idx on public.push_subscriptions (employee_id);

-- Een medewerker ziet en verwijdert alleen de eigen toestellen. Beheerders lezen alles om te
-- kunnen versturen, en ruimen op als de pushdienst zegt dat een abonnement niet meer bestaat.
-- Aanmelden gaat via register_push_subscription; wijzigen kan alleen last_success_at.
alter table public.push_subscriptions enable row level security;
revoke all on table public.push_subscriptions from anon, authenticated;
grant select, delete on table public.push_subscriptions to authenticated;
grant update (last_success_at) on table public.push_subscriptions to authenticated;
grant all on table public.push_subscriptions to service_role;
drop policy if exists push_subscriptions_select on public.push_subscriptions;
create policy push_subscriptions_select on public.push_subscriptions for select to authenticated
  using (employee_id = (select private.current_employee_id()) or (select private.is_admin()));
drop policy if exists push_subscriptions_delete on public.push_subscriptions;
create policy push_subscriptions_delete on public.push_subscriptions for delete to authenticated
  using (employee_id = (select private.current_employee_id()) or (select private.is_admin()));
drop policy if exists push_subscriptions_update on public.push_subscriptions;
create policy push_subscriptions_update on public.push_subscriptions for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

-- Meldingen aanzetten op dit toestel. Hoort het toestel nog bij iemand anders (bijvoorbeeld na
-- opnieuw inloggen), dan hoort het voortaan bij jou. Hooguit tien toestellen per medewerker:
-- daarboven verdwijnt het oudste.
create or replace function public.register_push_subscription(p_endpoint text, p_p256dh text, p_auth text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := private.current_employee_id();
begin
  if me is null then
    raise exception 'Alleen een actieve medewerker kan meldingen aanzetten.' using errcode = '42501';
  end if;
  delete from public.push_subscriptions where endpoint = p_endpoint and employee_id <> me;
  insert into public.push_subscriptions (employee_id, endpoint, p256dh, auth)
  values (me, p_endpoint, p_p256dh, p_auth)
  on conflict (endpoint) do update set p256dh = excluded.p256dh, auth = excluded.auth;
  delete from public.push_subscriptions
   where employee_id = me
     and id not in (
       select id from public.push_subscriptions where employee_id = me order by created_at desc, id limit 10
     );
end;
$$;
revoke all on function public.register_push_subscription(text, text, text) from public, anon, authenticated;
grant execute on function public.register_push_subscription(text, text, text) to authenticated;

-- ---------------------------------------------------------------------
-- 20261004000200_push_phase4.sql
-- ---------------------------------------------------------------------

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

-- ---------------------------------------------------------------------
-- 20261006000100_mail_invite.sql
-- ---------------------------------------------------------------------

-- Planbord · fase 4 · aanvulling V33 · de uitnodiging
-- Een nieuwe soort mail in de wachtrij: invite = de uitnodiging die een beheerder verstuurt.
-- Net als de testmail zonder datums. Verder verandert er niets aan de wachtrij.

alter table public.mail_queue drop constraint if exists mail_queue_kind;
alter table public.mail_queue add constraint mail_queue_kind check (
  kind in ('substitution_assigned', 'substitution_cancelled', 'day_changed', 'reminder', 'test', 'invite')
);

alter table public.mail_queue drop constraint if exists mail_queue_dates;
alter table public.mail_queue add constraint mail_queue_dates check (
  cardinality(dates) <= 100
  and (kind <> 'reminder' or cardinality(dates) = 1)
  and (kind in ('test', 'invite') or cardinality(dates) >= 1)
  and (kind <> 'invite' or cardinality(dates) = 0)
);

-- ---------------------------------------------------------------------
-- 20261006000200_employee_sign_ins.sql
-- ---------------------------------------------------------------------

-- Planbord · fase 4 · aanvulling V38 · wie er al is ingelogd
-- Beheerders zien per medewerker wanneer die voor het laatst inlogde, om te zien wie er al is
-- begonnen. Dat tijdstip houdt Supabase Auth zelf bij (auth.users.last_sign_in_at): Planbord slaat
-- niets extra op. Alleen een beheerder kan het lezen, alleen voor medewerkers met een inlogaccount,
-- en zonder e-mailadressen. Met p_employee_id alleen die ene medewerker.

create or replace function public.employee_sign_ins(p_employee_id uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'Alleen een beheerder kan zien wie er is ingelogd.' using errcode = '42501';
  end if;
  return coalesce(
    (
      select jsonb_agg(
        jsonb_build_object('employee_id', a.employee_id, 'last_sign_in_at', u.last_sign_in_at)
        order by a.employee_id
      )
      from public.employee_accounts a
      join auth.users u on u.id = a.user_id
      where p_employee_id is null or a.employee_id = p_employee_id
    ),
    '[]'::jsonb
  );
end;
$$;

revoke all on function public.employee_sign_ins(uuid) from public, anon, authenticated;
grant execute on function public.employee_sign_ins(uuid) to authenticated;

commit;
