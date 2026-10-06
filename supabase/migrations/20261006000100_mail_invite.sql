-- Planbord · fase 4 · aanvulling V33 · de uitnodiging
-- Een nieuwe soort mail in de wachtrij: invite = de uitnodiging die een beheerder verstuurt.
-- Net als de testmail zonder datums. Verder verandert er niets aan de wachtrij.

alter table public.mail_queue drop constraint if exists mail_queue_kind;
alter table public.mail_queue add constraint mail_queue_kind check (
  kind in ('substitution_assigned', 'substitution_cancelled', 'day_changed', 'reminder', 'test', 'invite')
);

alter table public.mail_queue drop constraint if exists mail_queue_dates;
alter table public.mail_queue add constraint mail_queue_dates check (
  cardinality(dates) <= 100
  and (kind <> 'reminder' or cardinality(dates) = 1)
  and (kind in ('test', 'invite') or cardinality(dates) >= 1)
  and (kind <> 'invite' or cardinality(dates) = 0)
);
