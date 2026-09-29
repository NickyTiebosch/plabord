-- Planbord · fase 1 · 01 basis
-- Extensies, schema private, updated_at-trigger, groepen, instellingen en normen.

create schema if not exists extensions;
create extension if not exists btree_gist with schema extensions;

-- Hulpfuncties staan in een eigen schema dat niet via de API bereikbaar is.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function private.set_updated_at() from public, anon, authenticated;

-- Groepen: de drie vestigingen met een balie en de ondersteunende groepen.
create table if not exists public.groups (
  id text primary key,
  name text not null,
  has_counter boolean not null default false,
  sort_order smallint not null default 0,
  substitution_rank smallint not null default 1,
  updated_at timestamptz not null default now(),
  constraint groups_id_format check (id ~ '^[a-z][a-z_]*$'),
  constraint groups_name_format check (name = btrim(name) and char_length(name) between 1 and 40),
  constraint groups_substitution_rank_range check (substitution_rank between 1 and 99),
  constraint groups_id_has_counter_key unique (id, has_counter)
);
create or replace trigger set_updated_at before update on public.groups
  for each row execute function private.set_updated_at();

-- Instellingen: precies één rij.
create table if not exists public.settings (
  id boolean primary key default true,
  standard_shift_start time not null default '07:30',
  standard_shift_end time not null default '18:00',
  saturday_shift_start time not null default '07:30',
  saturday_shift_end time not null default '18:00',
  day_part_boundary time not null default '13:00',
  lookahead_weeks smallint not null default 8,
  updated_at timestamptz not null default now(),
  constraint settings_singleton check (id),
  constraint settings_standard_shift_order check (standard_shift_end > standard_shift_start),
  constraint settings_saturday_shift_order check (saturday_shift_end > saturday_shift_start),
  constraint settings_lookahead_range check (lookahead_weeks between 1 and 52)
);
create or replace trigger set_updated_at before update on public.settings
  for each row execute function private.set_updated_at();

-- Norm: minimaal aantal mensen aan de balie per vestiging, weekdag en dagdeel (gebruikt vanaf fase 2).
create table if not exists public.staffing_norms (
  group_id text not null,
  has_counter boolean not null default true,
  weekday smallint not null,
  day_part text not null,
  min_staff smallint not null default 0,
  updated_at timestamptz not null default now(),
  primary key (group_id, weekday, day_part),
  constraint staffing_norms_counter_only check (has_counter),
  constraint staffing_norms_weekday_range check (weekday between 1 and 6),
  constraint staffing_norms_day_part check (day_part in ('morning', 'afternoon')),
  constraint staffing_norms_min_staff_range check (min_staff between 0 and 50),
  constraint staffing_norms_group_fkey foreign key (group_id, has_counter)
    references public.groups (id, has_counter) on update cascade on delete cascade
);
create or replace trigger set_updated_at before update on public.staffing_norms
  for each row execute function private.set_updated_at();
