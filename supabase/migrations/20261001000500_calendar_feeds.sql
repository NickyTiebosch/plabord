-- Planbord · fase 1 · 05 agendafeeds
-- Alleen de SHA-256-hash van het token wordt bewaard; de link zelf is alleen bij het aanmaken te zien.

create table if not exists public.calendar_feeds (
  id uuid primary key default gen_random_uuid(),
  -- De eigenaar van de link.
  employee_id uuid not null references public.employees (id) on delete cascade,
  kind text not null,
  -- Alleen bij een vestigingsfeed.
  group_id text references public.groups (id) on update cascade on delete cascade,
  token_hash text not null,
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  constraint calendar_feeds_kind check (kind in ('personal', 'location', 'absences')),
  constraint calendar_feeds_group check ((kind = 'location') = (group_id is not null)),
  constraint calendar_feeds_token_hash_format check (token_hash ~ '^[0-9a-f]{64}$'),
  constraint calendar_feeds_token_hash_key unique (token_hash)
);
-- Per eigenaar per feed hoogstens één actieve link.
create unique index if not exists calendar_feeds_active_key
  on public.calendar_feeds (employee_id, kind, coalesce(group_id, ''))
  where revoked_at is null;

alter table public.calendar_feeds enable row level security;
revoke all on table public.calendar_feeds from anon, authenticated;
grant select on table public.calendar_feeds to authenticated;
grant insert (employee_id, kind, group_id, token_hash) on table public.calendar_feeds to authenticated;
grant update (revoked_at) on table public.calendar_feeds to authenticated;
grant all on table public.calendar_feeds to service_role;
drop policy if exists calendar_feeds_select on public.calendar_feeds;
create policy calendar_feeds_select on public.calendar_feeds for select to authenticated
  using (employee_id = (select private.current_employee_id()) or (select private.is_admin()));
-- Een link maak je alleen voor jezelf: alleen jij krijgt hem te zien.
drop policy if exists calendar_feeds_insert on public.calendar_feeds;
create policy calendar_feeds_insert on public.calendar_feeds for insert to authenticated
  with check (employee_id = (select private.current_employee_id()) and revoked_at is null);
-- Intrekken mag de eigenaar en de beheerder. Een ingetrokken link kan niet terug.
drop policy if exists calendar_feeds_update on public.calendar_feeds;
create policy calendar_feeds_update on public.calendar_feeds for update to authenticated
  using ((employee_id = (select private.current_employee_id()) or (select private.is_admin())) and revoked_at is null)
  with check (revoked_at is not null);
