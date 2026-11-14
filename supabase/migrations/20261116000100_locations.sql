-- Planbord · fase 8 · 01 locatie van huurauto's (docs/PLAN-fase-8.md, V72–V78)
--
-- Per vestiging de plekken op het terrein, en per auto waar die nu staat. De tabel bewaart alleen de
-- huidige plek; de geschiedenis staat in het logboek. Geen klantgegevens.

-- Plekken per vestiging (V73). De beheerder beheert ze.
create table if not exists public.parking_spots (
  id uuid primary key default gen_random_uuid(),
  group_id text not null,
  has_counter boolean not null default true,
  name text not null,
  sort_order smallint not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint parking_spots_counter_only check (has_counter),
  constraint parking_spots_group_fkey foreign key (group_id, has_counter)
    references public.groups (id, has_counter) on update cascade,
  constraint parking_spots_name_format check (name = btrim(name) and char_length(name) between 1 and 20),
  constraint parking_spots_name_key unique (group_id, name),
  constraint parking_spots_order check (sort_order between 0 and 999),
  constraint parking_spots_id_group_key unique (id, group_id)
);
create or replace trigger audit after insert or update or delete on public.parking_spots
  for each row execute function private.audit_row('group_id', 'name', 'sort_order', 'is_active');

alter table public.parking_spots enable row level security;
revoke all on table public.parking_spots from anon, authenticated;
grant select on table public.parking_spots to authenticated;
grant insert (group_id, name, sort_order, is_active), update (name, sort_order, is_active), delete
  on table public.parking_spots to authenticated;
grant all on table public.parking_spots to service_role;
drop policy if exists parking_spots_select on public.parking_spots;
create policy parking_spots_select on public.parking_spots for select to authenticated
  using ((select private.current_employee_id()) is not null);
drop policy if exists parking_spots_insert on public.parking_spots;
create policy parking_spots_insert on public.parking_spots for insert to authenticated
  with check ((select private.is_admin()));
drop policy if exists parking_spots_update on public.parking_spots;
create policy parking_spots_update on public.parking_spots for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
drop policy if exists parking_spots_delete on public.parking_spots;
create policy parking_spots_delete on public.parking_spots for delete to authenticated
  using ((select private.is_admin()));

-- Startwaarden voor Den Bosch, uit het huidige bestand. Eindhoven en Breda beginnen leeg. Alleen
-- als er voor Den Bosch nog geen plekken zijn, zodat opnieuw draaien niets terugzet.
do $$
begin
  if not exists (select 1 from public.parking_spots where group_id = 'den_bosch')
     and exists (select 1 from public.groups where id = 'den_bosch' and has_counter) then
    perform set_config('app.audit_source', 'setup', true);
    insert into public.parking_spots (group_id, name, sort_order)
    values ('den_bosch', 'Zijkant', 1), ('den_bosch', 'Achter', 2), ('den_bosch', 'S 18', 10), ('den_bosch', 'S 20', 11), ('den_bosch', 'S 22', 12)
    on conflict do nothing;
    perform set_config('app.audit_source', '', true);
  end if;
end;
$$;

-- Waar een auto nu staat (V74). Een kenteken staat op één plek tegelijk. Schrijven alleen via de
-- functies hieronder.
create table if not exists public.vehicle_locations (
  license_plate text primary key,
  -- Alleen voor het logboek: zo staat bij een wijziging om welke auto het gaat.
  id uuid not null default gen_random_uuid() unique,
  group_id text not null,
  spot_id uuid not null,
  model text,
  moved_by uuid references public.employees (id) on delete set null,
  moved_at timestamptz not null default now(),
  constraint vehicle_locations_spot_fkey foreign key (spot_id, group_id)
    references public.parking_spots (id, group_id) on delete restrict,
  constraint vehicle_locations_plate_format check (license_plate ~ '^[A-Z0-9]{2,10}$'),
  constraint vehicle_locations_model_format check (model is null or (model = btrim(model) and char_length(model) between 1 and 60))
);
create index if not exists vehicle_locations_group_idx on public.vehicle_locations (group_id, spot_id);
create or replace trigger audit after insert or update or delete on public.vehicle_locations
  for each row execute function private.audit_row('license_plate', 'group_id', 'spot_id', 'model');

alter table public.vehicle_locations enable row level security;
revoke all on table public.vehicle_locations from anon, authenticated;
grant select on table public.vehicle_locations to authenticated;
grant all on table public.vehicle_locations to service_role;
drop policy if exists vehicle_locations_select on public.vehicle_locations;
create policy vehicle_locations_select on public.vehicle_locations for select to authenticated
  using ((select private.current_employee_id()) is not null);

-- Een auto op een plek zetten (V74, V75). Staat hij al ergens, dan verhuist hij. Zonder model: het
-- model dat er al stond, of het model van de laatste uitleen van dat kenteken.
create or replace function public.place_vehicle(p_plate text, p_spot_id uuid, p_model text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := private.current_employee_id();
  spot public.parking_spots%rowtype;
  clean_model text := nullif(btrim(coalesce(p_model, '')), '');
begin
  if me is null then
    raise exception 'Alleen een actieve medewerker kan een auto verzetten.' using errcode = '42501';
  end if;
  if p_plate is null or p_plate !~ '^[A-Z0-9]{2,10}$' then
    raise exception 'Vul een kenteken in: 2 tot 10 letters en cijfers.' using errcode = '22023';
  end if;
  select * into spot from public.parking_spots where id = p_spot_id;
  if not found or not spot.is_active then
    raise exception 'Deze plek bestaat niet (meer).' using errcode = '22023';
  end if;
  if clean_model is null then
    select coalesce(
      (select l.model from public.vehicle_locations l where l.license_plate = p_plate),
      (select v.model from public.vehicle_loans v where v.license_plate = p_plate order by v.handed_out_at desc limit 1)
    ) into clean_model;
  end if;
  insert into public.vehicle_locations as l (license_plate, group_id, spot_id, model, moved_by, moved_at)
  values (p_plate, spot.group_id, spot.id, left(clean_model, 60), me, now())
  on conflict (license_plate) do update
    set group_id = excluded.group_id, spot_id = excluded.spot_id, model = excluded.model, moved_by = me, moved_at = now();
end;
$$;
revoke all on function public.place_vehicle(text, uuid, text) from public, anon, authenticated;
grant execute on function public.place_vehicle(text, uuid, text) to authenticated;

-- Weg van het terrein (V74), bijvoorbeeld verhuurd.
create or replace function public.remove_vehicle(p_plate text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  removed integer;
begin
  if private.current_employee_id() is null then
    raise exception 'Alleen een actieve medewerker kan een auto verzetten.' using errcode = '42501';
  end if;
  delete from public.vehicle_locations where license_plate = p_plate;
  get diagnostics removed = row_count;
  return removed > 0;
end;
$$;
revoke all on function public.remove_vehicle(text) from public, anon, authenticated;
grant execute on function public.remove_vehicle(text) to authenticated;

-- De startlijst inlezen (bouwvolgorde 5): alleen de beheerder. Onbekende plekken worden toegevoegd.
-- rows: [{plate, spot, model?}]. Geeft het aantal auto's terug.
create or replace function public.import_locations(p_group_id text, p_rows jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := private.current_employee_id();
  previous text := current_setting('app.audit_source', true);
  saved integer;
begin
  if not private.is_admin() then
    raise exception 'Alleen een beheerder kan de lijst inlezen.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.groups where id = p_group_id and has_counter) then
    raise exception 'Kies een vestiging met een balie.' using errcode = '22023';
  end if;
  perform set_config('app.audit_source', 'import', true);
  insert into public.parking_spots (group_id, name, sort_order)
  select distinct p_group_id, btrim(r ->> 'spot'), 100
  from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) as r
  where nullif(btrim(r ->> 'spot'), '') is not null
  on conflict (group_id, name) do nothing;
  with rows as (
    select distinct on (r ->> 'plate') r ->> 'plate' as plate, btrim(r ->> 'spot') as spot, nullif(btrim(coalesce(r ->> 'model', '')), '') as model
    from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) as r
  ), placed as (
    insert into public.vehicle_locations as l (license_plate, group_id, spot_id, model, moved_by, moved_at)
    select rows.plate, p_group_id, s.id, left(rows.model, 60), me, now()
    from rows join public.parking_spots s on s.group_id = p_group_id and s.name = rows.spot
    on conflict (license_plate) do update
      set group_id = excluded.group_id, spot_id = excluded.spot_id, model = coalesce(excluded.model, l.model), moved_by = me, moved_at = now()
    returning 1
  )
  select count(*) into saved from placed;
  perform set_config('app.audit_source', coalesce(previous, ''), true);
  return saved;
end;
$$;
revoke all on function public.import_locations(text, jsonb) from public, anon, authenticated;
grant execute on function public.import_locations(text, jsonb) to authenticated;

-- Exports (V78): ook de locatie, voor beheerder en teamleider.
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
  if p_kind is null or p_kind not in ('planning', 'employee', 'loans', 'walk_ins', 'incidents', 'reports', 'locations') then
    raise exception 'Onbekende export.' using errcode = '22023';
  end if;
  if p_kind in ('loans', 'walk_ins', 'incidents', 'reports', 'locations') then
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
