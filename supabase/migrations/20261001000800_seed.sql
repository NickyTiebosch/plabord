-- Planbord · fase 1 · 08 seed
-- De groepen, instellingen, normen en invalvolgorde uit de opdracht. Geen medewerkers:
-- de eerste beheerder maak je aan met de stappen in de README.
-- Bestaande waarden worden nooit overschreven.

do $$
begin
  perform set_config('app.audit_source', 'setup', true);

  -- Invalvolgorde (fase 2): Backoffice, Overig, een andere vestiging, Logistiek.
  insert into public.groups (id, name, has_counter, sort_order, substitution_rank) values
    ('den_bosch', 'Den Bosch', true, 1, 3),
    ('eindhoven', 'Eindhoven', true, 2, 3),
    ('breda', 'Breda', true, 3, 3),
    ('logistics', 'Logistiek', false, 4, 4),
    ('backoffice', 'Backoffice', false, 5, 1),
    ('other', 'Overig', false, 6, 2)
  on conflict (id) do nothing;

  -- Standaarddienst 07:30–18:00 (ook op zaterdag), dagdeelgrens 13:00, 8 weken vooruitkijken.
  insert into public.settings (id) values (true)
  on conflict (id) do nothing;

  -- Norm: 2 mensen aan de balie per vestiging, ma–vr, 's ochtends en 's middags. Zaterdag geen norm.
  insert into public.staffing_norms (group_id, weekday, day_part, min_staff)
  select g.id, d.weekday, p.day_part, case when d.weekday <= 5 then 2 else 0 end
    from public.groups g
   cross join generate_series(1, 6) as d(weekday)
   cross join (values ('morning'), ('afternoon')) as p(day_part)
   where g.has_counter
  on conflict (group_id, weekday, day_part) do nothing;
end;
$$;
