-- =====================================================================
-- Planbord · Fase 7: rapporten en signalen
--
-- Draai eerst fase-1.sql tot en met fase-6.sql. Deze bundel voegt twee tabellen met maandtotalen, zes instellingen voor de signalen en functies voor de rapporten toe; de app van fase 6 merkt er niets van.
--
-- Plak dit hele bestand in Supabase: SQL Editor → New query → Run.
-- Het is veilig om opnieuw te draaien: bestaande tabellen en gegevens blijven staan.
--
-- Gegenereerd met `npm run db:bundle` uit supabase/migrations. Niet met de hand aanpassen.
-- =====================================================================

begin;
-- ---------------------------------------------------------------------
-- 20261115000100_reports.sql
-- ---------------------------------------------------------------------

-- Planbord · fase 7 · 01 rapporten en signalen (docs/PLAN-fase-7.md, V66–V71)
--
-- Geen nieuwe invoer: de rapporten tellen uit binnenvallers, meldingen en de uitleen. Twee tabellen
-- bewaren per maand de aantallen van meldingen en uitleen, zonder kentekens, nummers of namen, zodat
-- de jaarcijfers blijven kloppen als de regels zelf na 24 maanden verdwijnen. De geplande taak houdt
-- ze bij. Het zijn afgeleide cijfers: ze staan niet in het logboek.

-- Signalen op Start (V69). Leeg = dat signaal staat uit.
alter table public.settings add column if not exists signal_incident_factor smallint default 2;
alter table public.settings add column if not exists signal_incident_min smallint not null default 3;
alter table public.settings add column if not exists signal_unclosed_days smallint default 2;
alter table public.settings add column if not exists signal_charge_days smallint default 14;
alter table public.settings add column if not exists signal_short_days smallint default 2;
alter table public.settings add column if not exists signal_unused_percent smallint default 33;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'settings_signal_bounds') then
    alter table public.settings add constraint settings_signal_bounds check (
      (signal_incident_factor is null or signal_incident_factor between 2 and 10)
      and signal_incident_min between 1 and 50
      and (signal_unclosed_days is null or signal_unclosed_days between 1 and 6)
      and (signal_charge_days is null or signal_charge_days between 1 and 90)
      and (signal_short_days is null or signal_short_days between 1 and 5)
      and (signal_unused_percent is null or signal_unused_percent between 1 and 100)
    );
  end if;
end;
$$;
grant update (
  signal_incident_factor, signal_incident_min, signal_unclosed_days, signal_charge_days, signal_short_days, signal_unused_percent
) on table public.settings to authenticated;

create or replace trigger audit after insert or update or delete on public.settings
  for each row execute function private.audit_row(
    'standard_shift_start', 'standard_shift_end', 'saturday_shift_start', 'saturday_shift_end',
    'day_part_boundary', 'lookahead_weeks', 'mail_enabled', 'charge_cancellation_from', 'day_close_reminder_at',
    'signal_incident_factor', 'signal_incident_min', 'signal_unclosed_days', 'signal_charge_days',
    'signal_short_days', 'signal_unused_percent'
  );

-- Meldingen per maand, vestiging, werkplaats en soort (V66, plan §2). De werkplaats zonder
-- verwijzing: een werkplaats kan worden verwijderd als de meldingen zelf al zijn opgeruimd.
create table if not exists public.monthly_incident_totals (
  month date not null,
  group_id text not null references public.groups (id) on update cascade on delete cascade,
  workshop_id uuid not null,
  kind text not null,
  total integer not null default 0,
  chargeable integer not null default 0,
  charged integer not null default 0,
  refreshed_at timestamptz not null default now(),
  primary key (month, group_id, workshop_id, kind),
  constraint monthly_incident_totals_month check (month = date_trunc('month', month)::date),
  constraint monthly_incident_totals_counts check (total >= 0 and chargeable between 0 and total and charged between 0 and chargeable)
);
alter table public.monthly_incident_totals enable row level security;
revoke all on table public.monthly_incident_totals from anon, authenticated;
grant select on table public.monthly_incident_totals to authenticated;
grant all on table public.monthly_incident_totals to service_role;
drop policy if exists monthly_incident_totals_select on public.monthly_incident_totals;
create policy monthly_incident_totals_select on public.monthly_incident_totals for select to authenticated
  using ((select private.is_lead()));

-- De uitleen per maand (van meegeven), vestiging en bestemming.
create table if not exists public.monthly_loan_totals (
  month date not null,
  group_id text not null references public.groups (id) on update cascade on delete cascade,
  destination text not null,
  total integer not null default 0,
  used integer not null default 0,
  unused integer not null default 0,
  refreshed_at timestamptz not null default now(),
  primary key (month, group_id, destination),
  constraint monthly_loan_totals_month check (month = date_trunc('month', month)::date),
  constraint monthly_loan_totals_counts check (total >= 0 and used >= 0 and unused >= 0 and used + unused <= total)
);
alter table public.monthly_loan_totals enable row level security;
revoke all on table public.monthly_loan_totals from anon, authenticated;
grant select on table public.monthly_loan_totals to authenticated;
grant all on table public.monthly_loan_totals to service_role;
drop policy if exists monthly_loan_totals_select on public.monthly_loan_totals;
create policy monthly_loan_totals_select on public.monthly_loan_totals for select to authenticated
  using ((select private.is_lead()));

-- De eerste maand waarvan de regels zelf er nog allemaal zijn: 23 maanden terug. Wat ouder is, komt
-- uit de maandtotalen.
create or replace function private.report_cutoff()
returns date
language sql
stable
set search_path = ''
as $$
  select (date_trunc('month', (now() at time zone 'Europe/Amsterdam')::date) - interval '23 months')::date;
$$;
revoke all on function private.report_cutoff() from public, anon, authenticated;

-- De maandtotalen bijwerken: alle maanden waarvan de regels er nog helemaal zijn. Alleen de
-- geplande taak (secret key). Geeft het aantal bijgewerkte maanden terug.
create or replace function public.refresh_monthly_totals()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  first_month date := private.report_cutoff();
begin
  delete from public.monthly_incident_totals where month >= first_month;
  insert into public.monthly_incident_totals (month, group_id, workshop_id, kind, total, chargeable, charged)
  select date_trunc('month', (i.occurred_at at time zone 'Europe/Amsterdam')::date)::date, i.group_id, i.workshop_id, i.kind,
         count(*)::integer, (count(*) filter (where i.charge))::integer, (count(*) filter (where i.charged_at is not null))::integer
  from public.incident_reports i
  where (i.occurred_at at time zone 'Europe/Amsterdam')::date >= first_month
  group by 1, 2, 3, 4;

  delete from public.monthly_loan_totals where month >= first_month;
  insert into public.monthly_loan_totals (month, group_id, destination, total, used, unused)
  select date_trunc('month', (l.handed_out_at at time zone 'Europe/Amsterdam')::date)::date, l.group_id, l.destination,
         count(*)::integer, (count(*) filter (where l.was_used is true))::integer, (count(*) filter (where l.was_used is false))::integer
  from public.vehicle_loans l
  where (l.handed_out_at at time zone 'Europe/Amsterdam')::date >= first_month
  group by 1, 2, 3;

  return (select count(distinct month)::integer from public.monthly_incident_totals where month >= first_month)
       + (select count(distinct month)::integer from public.monthly_loan_totals where month >= first_month);
end;
$$;
revoke all on function public.refresh_monthly_totals() from public, anon, authenticated;
grant execute on function public.refresh_monthly_totals() to service_role;

-- Binnenvallers per periode (week, maand of jaar), vestiging en werkplaats. Alleen beheerder en
-- teamleider. Binnenvallers worden niet opgeruimd: altijd uit de regels zelf.
create or replace function public.report_walk_ins(p_unit text, p_from date, p_to date)
returns table (bucket date, group_id text, workshop_id uuid, total integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_lead() then
    raise exception 'Alleen een beheerder of teamleider kan rapporten zien.' using errcode = '42501';
  end if;
  if p_unit is null or p_unit not in ('week', 'month', 'year') or p_from is null or p_to is null or p_to < p_from then
    raise exception 'Kies een geldige periode.' using errcode = '22023';
  end if;
  return query
    select date_trunc(p_unit, w.date)::date, w.group_id, w.workshop_id, sum(w.count)::integer
    from public.walk_ins w
    where w.date between p_from and p_to
    group by 1, 2, 3;
end;
$$;
revoke all on function public.report_walk_ins(text, date, date) from public, anon, authenticated;
grant execute on function public.report_walk_ins(text, date, date) to authenticated;

-- Meldingen per periode, vestiging, werkplaats en soort: aantal, door te belasten en doorbelast.
-- Maanden ouder dan de grens komen uit de maandtotalen (alleen bij maand en jaar).
create or replace function public.report_incidents(p_unit text, p_from date, p_to date)
returns table (bucket date, group_id text, workshop_id uuid, kind text, total integer, chargeable integer, charged integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  cutoff date := private.report_cutoff();
begin
  if not private.is_lead() then
    raise exception 'Alleen een beheerder of teamleider kan rapporten zien.' using errcode = '42501';
  end if;
  if p_unit is null or p_unit not in ('week', 'month', 'year') or p_from is null or p_to is null or p_to < p_from then
    raise exception 'Kies een geldige periode.' using errcode = '22023';
  end if;
  return query
    select date_trunc(p_unit, d.day)::date, d.group_id, d.workshop_id, d.kind,
           count(*)::integer, (count(*) filter (where d.charge))::integer, (count(*) filter (where d.charged))::integer
    from (
      select (i.occurred_at at time zone 'Europe/Amsterdam')::date as day, i.group_id, i.workshop_id, i.kind,
             coalesce(i.charge, false) as charge, i.charged_at is not null as charged
      from public.incident_reports i
    ) d
    where d.day between greatest(p_from, case when p_unit = 'week' then p_from else cutoff end) and p_to
    group by 1, 2, 3, 4
    union all
    select date_trunc(p_unit, t.month)::date, t.group_id, t.workshop_id, t.kind, sum(t.total)::integer, sum(t.chargeable)::integer,
           sum(t.charged)::integer
    from public.monthly_incident_totals t
    where p_unit <> 'week' and t.month < cutoff and t.month between date_trunc('month', p_from)::date and p_to
    group by 1, 2, 3, 4;
end;
$$;
revoke all on function public.report_incidents(text, date, date) from public, anon, authenticated;
grant execute on function public.report_incidents(text, date, date) to authenticated;

-- Exports (V70): ook de rapporten, voor beheerder en teamleider.
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
  if p_kind is null or p_kind not in ('planning', 'employee', 'loans', 'walk_ins', 'incidents', 'reports') then
    raise exception 'Onbekende export.' using errcode = '22023';
  end if;
  if p_kind in ('loans', 'walk_ins', 'incidents', 'reports') then
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

commit;
