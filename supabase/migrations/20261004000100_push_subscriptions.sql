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
