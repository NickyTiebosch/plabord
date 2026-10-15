'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { isUuid } from '@/lib/admin/forms';
import { gapPath, planningWindow, safeReturnPath, withNotice } from '@/lib/admin/planning';
import { requireAdmin } from '@/lib/auth/session';
import type { Json } from '@/lib/db/database.types';
import { toDayPartColumn } from '@/lib/db/mappers';
import { loadPlanningSnapshot, loadSettings } from '@/lib/db/queries';
import { reviewAfterChange, reviewNotices } from '@/lib/db/review';
import { assignmentDecision, evaluateCandidates } from '@/lib/engine/candidates';
import { eachDay, isIsoDate, todayInAmsterdam } from '@/lib/engine/dates';
import { reviewSubstitutions } from '@/lib/engine/review';
import { createScheduleContext } from '@/lib/engine/schedule';
import { planSelfCover, type SelfCoverCode } from '@/lib/engine/self-cover';
import { createNormLookup, staffingOf } from '@/lib/engine/staffing';
import { DAY_PARTS, type DayPart } from '@/lib/engine/types';
import { mailAfterAction } from '@/lib/mail/after-action';
import type { MailOutcome } from '@/lib/mail/outcome';

function dayPartsFrom(formData: FormData): DayPart[] {
  const values = formData.getAll('dayPart').filter((value): value is string => typeof value === 'string');
  return DAY_PARTS.filter((part) => values.includes(part));
}

function done(formData: FormData, code: string, mail?: MailOutcome | null): never {
  redirect(withNotice(safeReturnPath(formData.get('terug'), '/beheer'), code, mail));
}

/**
 * Een inval toewijzen. Nooit zonder deze klik van de beheerder; vlak vóór het opslaan opnieuw gecontroleerd.
 * Met `schuiven` (V40): Toch inzetten, ook al zakt de eigen vestiging dan onder de norm. Alleen als de
 * sleutel nog klopt met wat de beheerder zag; daarna door naar het nieuwe gat.
 */
export async function assignSubstitution(formData: FormData): Promise<void> {
  const { supabase } = await requireAdmin();
  const employeeId = String(formData.get('employeeId') ?? '');
  const groupId = String(formData.get('groupId') ?? '');
  const date = String(formData.get('date') ?? '');
  const dayParts = dayPartsFrom(formData);
  const rawKey = formData.get('schuiven');
  const moveKey = typeof rawKey === 'string' && rawKey !== '' ? rawKey : null;
  if (!isUuid(employeeId) || !isIsoDate(date) || dayParts.length === 0 || !/^[a-z_]{1,40}$/.test(groupId)) {
    done(formData, 'inval-ongeldig');
  }
  if (date < todayInAmsterdam(new Date())) done(formData, 'inval-verleden');

  const snapshot = await loadPlanningSnapshot(supabase, { from: date, to: date });
  const context = createScheduleContext(snapshot);
  const normOf = createNormLookup(snapshot.staffingNorms);
  const staffing = staffingOf(context, normOf, date, groupId);
  if (!dayParts.every((part) => staffing.parts.some((item) => item.dayPart === part && item.shortage > 0))) {
    done(formData, 'geen-gat-meer');
  }
  const evaluation = evaluateCandidates(context, normOf, snapshot.substitutions, { date, groupId, dayParts });
  const decision = assignmentDecision(evaluation, employeeId, moveKey);
  if (decision.kind === 'invalid') done(formData, moveKey ? 'schuiven-veranderd' : 'inval-niet-meer-geldig');

  const inserted = await supabase
    .from('substitutions')
    .insert({ employee_id: employeeId, date, group_id: groupId, day_part: toDayPartColumn(dayParts) });
  // 23505: een andere beheerder zette hem net ergens anders in (hooguit één inval per dag).
  if (inserted.error) done(formData, inserted.error.code === '23505' ? 'inval-niet-meer-geldig' : 'inval-mislukt');
  // De invaller krijgt meteen een mail (fase 3, V14).
  const mail = await mailAfterAction(supabase, [{ employeeId, kind: 'substitution_assigned', dates: [date] }]);
  revalidatePath('/', 'layout');
  // Schuiven (V40): meteen door naar het nieuwe gat in zijn eigen vestiging.
  if (decision.kind === 'move') redirect(withNotice(gapPath(decision.sourceGroupId, date), 'ingezet-nieuw-gat', mail));
  done(formData, 'ingezet', mail);
}

const SELF_COVER_NOTICES: Record<SelfCoverCode, string> = {
  past: 'zelf-verleden',
  no_counter: 'inval-ongeldig',
  no_gap: 'geen-gat-meer',
  inactive: 'inval-ongeldig',
  absent: 'zelf-afwezig',
  substituting: 'zelf-al-inval',
  already_there: 'zelf-al-daar',
  no_times: 'zelf-niet-mogelijk',
};

/**
 * Zelf inspringen (V40): de beheerder zet zichzelf die dag aan de balie van het gat. Een
 * roosterwijziging voor één dag, geen inval. Alleen voor jezelf: de medewerker komt uit de sessie,
 * nooit uit het formulier. Opgeslagen wordt alleen wat je in de vraag vooraf zag (`bevestigd`).
 * Geen mail aan jezelf; wel aan invallers van wie de inval daardoor vervalt.
 */
export async function coverGapMyself(formData: FormData): Promise<void> {
  const { supabase, employeeId } = await requireAdmin();
  const groupId = String(formData.get('groupId') ?? '');
  const date = String(formData.get('date') ?? '');
  const dayParts = dayPartsFrom(formData);
  if (!isIsoDate(date) || dayParts.length === 0 || !/^[a-z_]{1,40}$/.test(groupId)) done(formData, 'inval-ongeldig');
  const today = todayInAmsterdam(new Date());
  if (date < today) done(formData, 'zelf-verleden');

  const snapshot = await loadPlanningSnapshot(supabase, { from: date, to: date });
  const context = createScheduleContext(snapshot);
  const plan = planSelfCover(context, createNormLookup(snapshot.staffingNorms), { employeeId, date, groupId, dayParts, today });
  if (!plan.ok) done(formData, SELF_COVER_NOTICES[plan.code]);
  if (formData.get('bevestigd') !== plan.key) done(formData, 'zelf-veranderd');

  const saved = await supabase.rpc('set_shift_override', {
    p_employee_id: employeeId,
    p_date: date,
    p_kind: 'shift',
    p_group_id: groupId,
    p_role: 'counter',
    p_start_time: plan.stored.startTime,
    p_end_time: plan.stored.endTime,
  });
  if (saved.error) done(formData, 'wijziging-mislukt');
  // Invallen op die dag controleren (V10), zoals na elke roosterwijziging.
  const review = await reviewAfterChange(supabase, [date], today);
  const mail = await mailAfterAction(supabase, review.notices);
  revalidatePath('/', 'layout');
  const newGap = plan.source && plan.source.shortfall.length > 0 ? plan.source.groupId : null;
  const code = review.error
    ? 'controle-mislukt'
    : review.changes.length > 0
      ? 'invallen-vervallen'
      : newGap
        ? 'zelf-ingesprongen-nieuw-gat'
        : 'zelf-ingesprongen';
  // Zakt de balie waar je vandaan kwam onder de norm, dan meteen door naar dat gat.
  if (newGap) redirect(withNotice(gapPath(newGap, date), code, mail));
  done(formData, code, mail);
}

/** Een gat negeren (besluit V8): per dagdeel met het tekort van nu. */
export async function ignoreGap(formData: FormData): Promise<void> {
  const { supabase } = await requireAdmin();
  const groupId = String(formData.get('groupId') ?? '');
  const date = String(formData.get('date') ?? '');
  if (!isIsoDate(date) || !/^[a-z_]{1,40}$/.test(groupId)) done(formData, 'inval-ongeldig');

  const snapshot = await loadPlanningSnapshot(supabase, { from: date, to: date });
  const context = createScheduleContext(snapshot);
  const short = staffingOf(context, createNormLookup(snapshot.staffingNorms), date, groupId).parts.filter(
    (part) => part.shortage > 0,
  );
  if (short.length === 0) done(formData, 'geen-gat-meer');
  const existing = await supabase.from('gap_dismissals').select('id, day_part').eq('group_id', groupId).eq('date', date);
  for (const part of short) {
    const row = existing.data?.find((item) => item.day_part === part.dayPart);
    const saved = row
      ? await supabase.from('gap_dismissals').update({ shortage: part.shortage }).eq('id', row.id)
      : await supabase.from('gap_dismissals').insert({ group_id: groupId, date, day_part: part.dayPart, shortage: part.shortage });
    if (saved.error) done(formData, 'negeren-mislukt');
  }
  revalidatePath('/beheer', 'layout');
  done(formData, 'genegeerd');
}

/** Een genegeerd gat terugzetten in Nog te regelen. */
export async function unignoreGap(formData: FormData): Promise<void> {
  const { supabase } = await requireAdmin();
  const groupId = String(formData.get('groupId') ?? '');
  const date = String(formData.get('date') ?? '');
  if (!isIsoDate(date) || !/^[a-z_]{1,40}$/.test(groupId)) done(formData, 'inval-ongeldig');
  await supabase.from('gap_dismissals').delete().eq('group_id', groupId).eq('date', date);
  revalidatePath('/beheer', 'layout');
  done(formData, 'teruggezet');
}

/** Een vervallen inval afhandelen: de beheerder heeft het de invaller laten weten (besluit V10). */
export async function markHandled(formData: FormData): Promise<void> {
  const { supabase } = await requireAdmin();
  const id = String(formData.get('id') ?? '');
  if (!isUuid(id)) done(formData, 'inval-ongeldig');
  await supabase.from('substitutions').update({ handled_at: new Date().toISOString() }).eq('id', id).neq('status', 'active');
  revalidatePath('/beheer', 'layout');
  done(formData, 'afgehandeld');
}

/** Een inval intrekken: hij gaat niet door. Niet verwijderen; de status komt in het logboek. */
export async function withdrawSubstitution(formData: FormData): Promise<void> {
  const { supabase } = await requireAdmin();
  const id = String(formData.get('id') ?? '');
  if (!isUuid(id)) done(formData, 'inval-ongeldig');
  const withdrawn = await supabase
    .from('substitutions')
    .update({ status: 'not_needed', handled_at: new Date().toISOString() })
    .eq('id', id)
    .eq('status', 'active')
    .select('employee_id, date');
  // De invaller krijgt een mail dat de inval niet doorgaat (fase 3, V14).
  const mail = await mailAfterAction(
    supabase,
    (withdrawn.data ?? []).map((row) => ({ employeeId: row.employee_id, kind: 'substitution_cancelled' as const, dates: [row.date] })),
  );
  revalidatePath('/', 'layout');
  done(formData, 'ingetrokken', mail);
}

/** Invallen die niet meer kloppen bijwerken, na een klik op het overzicht. */
export async function applyWarnings(formData: FormData): Promise<void> {
  const { supabase } = await requireAdmin();
  const today = todayInAmsterdam(new Date());
  const window = planningWindow(today, (await loadSettings(supabase)).lookaheadWeeks);
  const snapshot = await loadPlanningSnapshot(supabase, window);
  const changes = reviewSubstitutions(snapshot, eachDay(window.from, window.to), today);
  let mail: MailOutcome | null = null;
  if (changes.length > 0) {
    const result = await supabase.rpc('apply_substitution_review', {
      changes: changes.map((change) => ({ id: change.substitutionId, status: change.status })) as unknown as Json,
    });
    if (result.error) done(formData, 'bijwerken-mislukt');
    mail = await mailAfterAction(supabase, reviewNotices(snapshot, changes));
  }
  revalidatePath('/', 'layout');
  done(formData, 'bijgewerkt', mail);
}
