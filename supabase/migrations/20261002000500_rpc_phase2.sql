-- Planbord · fase 2 · 05 functies die de app aanroept
-- Allemaal security invoker: de gewone rechten (RLS) gelden, dus alleen een beheerder kan dit.

-- Zet de roosterwijziging van één medewerker op één datum, nieuw of in plaats van de vorige.
create or replace function public.set_shift_override(
  p_employee_id uuid,
  p_date date,
  p_kind text,
  p_group_id text,
  p_role text,
  p_start_time time,
  p_end_time time
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  result uuid;
begin
  insert into public.shift_overrides as o (employee_id, date, kind, group_id, role, start_time, end_time)
  values (p_employee_id, p_date, p_kind, p_group_id, p_role, p_start_time, p_end_time)
  on conflict (employee_id, date) do update
    set kind = excluded.kind,
        group_id = excluded.group_id,
        role = excluded.role,
        start_time = excluded.start_time,
        end_time = excluded.end_time
  returning o.id into result;
  return result;
end;
$$;
revoke all on function public.set_shift_override(uuid, date, text, text, text, time, time) from public, anon, authenticated;
grant execute on function public.set_shift_override(uuid, date, text, text, text, time, time) to authenticated;

-- Verplaatsen (besluit V6): geen dienst op de oude dag en een dienst op de nieuwe dag, in één keer.
create or replace function public.move_shift(
  p_employee_id uuid,
  p_from date,
  p_to date,
  p_group_id text,
  p_role text,
  p_start_time time,
  p_end_time time
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if p_from = p_to then
    raise exception 'Kies een andere dag om de dienst naartoe te verplaatsen.' using errcode = '22023';
  end if;
  perform public.set_shift_override(p_employee_id, p_from, 'off', null, null, null, null);
  return public.set_shift_override(p_employee_id, p_to, 'shift', p_group_id, p_role, p_start_time, p_end_time);
end;
$$;
revoke all on function public.move_shift(uuid, date, date, text, text, time, time) from public, anon, authenticated;
grant execute on function public.move_shift(uuid, date, date, text, text, time, time) to authenticated;

-- Past de uitkomst van de controle op achterhaalde invallen toe (besluit V10), in één transactie.
-- Alleen invallen die nog doorgaan, veranderen van status. In het logboek staat dit als 'controle'.
create or replace function public.apply_substitution_review(changes jsonb)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  item jsonb;
  affected integer;
  total integer := 0;
begin
  if not private.is_admin() then
    raise exception 'Alleen een beheerder kan invallen wijzigen.' using errcode = '42501';
  end if;
  perform set_config('app.audit_source', 'controle', true);
  for item in select value from jsonb_array_elements(coalesce(changes, '[]'::jsonb)) loop
    if coalesce(item ->> 'status', '') not in ('not_needed', 'reschedule') then
      raise exception 'Onbekende status voor een inval.' using errcode = '22023';
    end if;
    update public.substitutions
       set status = item ->> 'status'
     where id = (item ->> 'id')::uuid
       and status = 'active';
    get diagnostics affected = row_count;
    total := total + affected;
  end loop;
  return total;
end;
$$;
revoke all on function public.apply_substitution_review(jsonb) from public, anon, authenticated;
grant execute on function public.apply_substitution_review(jsonb) to authenticated;
