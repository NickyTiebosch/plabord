-- Planbord · fase 2 · 03 genegeerde gaten
-- Een beheerder kan een gat negeren. Het blijft weg zolang het tekort niet groter wordt
-- dan bij het negeren. Alleen voor beheerders.

create table if not exists public.gap_dismissals (
  id uuid primary key default gen_random_uuid(),
  group_id text not null references public.groups (id) on update cascade on delete cascade,
  date date not null,
  day_part text not null,
  -- Het tekort op het moment van negeren.
  shortage smallint not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint gap_dismissals_day_part check (day_part in ('morning', 'afternoon')),
  constraint gap_dismissals_shortage check (shortage between 1 and 50),
  constraint gap_dismissals_date_bounds check (date between date '2000-01-01' and date '2100-12-31'),
  constraint gap_dismissals_unique unique (group_id, date, day_part)
);
create or replace trigger set_updated_at before update on public.gap_dismissals
  for each row execute function private.set_updated_at();

alter table public.gap_dismissals enable row level security;
revoke all on table public.gap_dismissals from anon, authenticated;
grant select, delete on table public.gap_dismissals to authenticated;
grant insert (group_id, date, day_part, shortage) on table public.gap_dismissals to authenticated;
grant update (shortage) on table public.gap_dismissals to authenticated;
grant all on table public.gap_dismissals to service_role;
drop policy if exists gap_dismissals_select on public.gap_dismissals;
create policy gap_dismissals_select on public.gap_dismissals for select to authenticated
  using ((select private.is_admin()));
drop policy if exists gap_dismissals_insert on public.gap_dismissals;
create policy gap_dismissals_insert on public.gap_dismissals for insert to authenticated
  with check ((select private.is_admin()));
drop policy if exists gap_dismissals_update on public.gap_dismissals;
create policy gap_dismissals_update on public.gap_dismissals for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
drop policy if exists gap_dismissals_delete on public.gap_dismissals;
create policy gap_dismissals_delete on public.gap_dismissals for delete to authenticated
  using ((select private.is_admin()));
