-- Planbord · fase 5 · 03 functies voor de uitleen, en de export van de uitleen in het logboek

-- Retour melden (V47): ingezet of niet ingezet. Iedere actieve medewerker, ook voor een auto die
-- een collega aanmeldde. Alleen de retourvelden veranderen, en alleen als de auto nog uit staat.
-- Zonder tijdstip geldt nu. Geeft het aantal gewijzigde regels terug: 0 = al retour of verdwenen.
create or replace function public.return_vehicle_loan(
  p_id uuid,
  p_was_used boolean,
  p_odometer_in integer default null,
  p_note text default null,
  p_returned_at timestamptz default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := private.current_employee_id();
  moment timestamptz := coalesce(p_returned_at, now());
  affected integer;
begin
  if me is null then
    raise exception 'Alleen een actieve medewerker kan een auto retour melden.' using errcode = '42501';
  end if;
  if p_was_used is null then
    raise exception 'Kies of de auto is ingezet.' using errcode = '22023';
  end if;
  if moment > now() + interval '5 minutes' then
    raise exception 'Het tijdstip van retour ligt in de toekomst.' using errcode = '22023';
  end if;
  update public.vehicle_loans
     set returned_at = moment,
         returned_by = me,
         was_used = p_was_used,
         odometer_in = p_odometer_in,
         return_note = nullif(btrim(coalesce(p_note, '')), '')
   where id = p_id
     and returned_at is null;
  get diagnostics affected = row_count;
  return affected;
end;
$$;
revoke all on function public.return_vehicle_loan(uuid, boolean, integer, text, timestamptz) from public, anon, authenticated;
grant execute on function public.return_vehicle_loan(uuid, boolean, integer, text, timestamptz) to authenticated;

-- Retour ongedaan maken (V47): wie retour meldde, op dezelfde dag (Nederlandse tijd); daarna alleen
-- een beheerder of teamleider. De auto staat daarna weer uit. Staat dezelfde auto intussen opnieuw
-- uit, dan kan het niet: een auto staat maar één keer tegelijk uit.
create or replace function public.undo_vehicle_loan_return(p_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := private.current_employee_id();
  loan public.vehicle_loans%rowtype;
  affected integer;
begin
  if me is null then
    raise exception 'Alleen een actieve medewerker kan dit.' using errcode = '42501';
  end if;
  select * into loan from public.vehicle_loans where id = p_id for update;
  if not found or loan.returned_at is null then
    return 0;
  end if;
  if not private.is_lead()
     and not (
       loan.returned_by = me
       and (loan.returned_at at time zone 'Europe/Amsterdam')::date = (now() at time zone 'Europe/Amsterdam')::date
     ) then
    raise exception 'Alleen wie de auto retour meldde kan dat vandaag ongedaan maken. Vraag het anders je teamleider.'
      using errcode = '42501';
  end if;
  update public.vehicle_loans
     set returned_at = null,
         returned_by = null,
         was_used = null,
         odometer_in = null,
         return_note = null
   where id = p_id;
  get diagnostics affected = row_count;
  return affected;
end;
$$;
revoke all on function public.undo_vehicle_loan_return(uuid) from public, anon, authenticated;
grant execute on function public.undo_vehicle_loan_return(uuid) to authenticated;

-- Een export in het logboek (besluit V20): wie, wanneer en welke. Nieuw in fase 5: 'loans', de
-- uitleen (V50), voor beheerder en teamleider. De planning en de gegevens van één medewerker
-- blijven alleen voor de beheerder.
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
  if p_kind is null or p_kind not in ('planning', 'employee', 'loans') then
    raise exception 'Onbekende export.' using errcode = '22023';
  end if;
  if p_kind = 'loans' then
    if not private.is_lead() then
      raise exception 'Alleen een beheerder of teamleider kan de uitleen exporteren.' using errcode = '42501';
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
