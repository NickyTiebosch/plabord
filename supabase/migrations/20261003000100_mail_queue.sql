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
