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
