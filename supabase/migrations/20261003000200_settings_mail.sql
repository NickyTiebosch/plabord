-- Planbord · fase 3 · 02 schakelaar "Mails versturen" (besluit V18)
-- Na de installatie staat hij uit. Zolang hij uit staat, gaat er geen mail naar collega's.

alter table public.settings add column if not exists mail_enabled boolean not null default false;
grant update (mail_enabled) on table public.settings to authenticated;

-- Het logboek legt het aan- en uitzetten vast, met de waarde.
create or replace trigger audit after insert or update or delete on public.settings
  for each row execute function private.audit_row(
    'standard_shift_start', 'standard_shift_end', 'saturday_shift_start', 'saturday_shift_end',
    'day_part_boundary', 'lookahead_weeks', 'mail_enabled'
  );
