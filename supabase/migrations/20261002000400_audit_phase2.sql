-- Planbord · fase 2 · 04 logboek voor invallen, roosterwijzigingen en genegeerde gaten
-- Net als in fase 1: alleen deze velden met waarde, nooit namen.

create or replace trigger audit after insert or update or delete on public.substitutions
  for each row execute function private.audit_row('date', 'group_id', 'day_part', 'status', 'handled_at');
create or replace trigger audit after insert or update or delete on public.shift_overrides
  for each row execute function private.audit_row('date', 'kind', 'group_id', 'role', 'start_time', 'end_time');
create or replace trigger audit after insert or update or delete on public.gap_dismissals
  for each row execute function private.audit_row('group_id', 'date', 'day_part', 'shortage');
