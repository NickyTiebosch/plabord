'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { isUuid } from '@/lib/admin/forms';
import { planningWindow, safeReturnPath, withNotice } from '@/lib/admin/planning';
import { requireAdmin } from '@/lib/auth/session';
import type { Json } from '@/lib/db/database.types';
import { toDayPartColumn } from '@/lib/db/mappers';
import { loadPlanningSnapshot, loadSettings } from '@/lib/db/queries';
import { evaluateCandidates } from '@/lib/engine/candidates';
import { eachDay, isIsoDate, todayInAmsterdam } from '@/lib/engine/dates';
import { reviewSubstitutions } from '@/lib/engine/review';
import { createScheduleContext } from '@/lib/engine/schedule';
import { createNormLookup, staffingOf } from '@/lib/engine/staffing';
import { DAY_PARTS, type DayPart } from '@/lib/engine/types';

function dayPartsFrom(formData: FormData): DayPart[] {
  const values = formData.getAll('dayPart').filter((value): value is string => typeof value === 'string');
  return DAY_PARTS.filter((part) => values.includes(part));
}

function done(formData: FormData, code: string): never {
  redirect(withNotice(safeReturnPath(formData.get('terug'), '/beheer'), code));
}

/** Een inval toewijzen. Nooit zonder deze klik van de beheerder; vlak vóór het opslaan opnieuw gecontroleerd. */
export async function assignSubstitution(formData: FormData): Promise<void> {
  const { supabase } = await requireAdmin();
  const employeeId = String(formData.get('employeeId') ?? '');
  const groupId = String(formData.get('groupId') ?? '');
  const date = String(formData.get('date') ?? '');
  const dayParts = dayPartsFrom(formData);
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
  const { candidates } = evaluateCandidates(context, normOf, snapshot.substitutions, { date, groupId, dayParts });
  if (!candidates.some((candidate) => candidate.employeeId === employeeId)) done(formData, 'inval-niet-meer-geldig');

  const inserted = await supabase
    .from('substitutions')
    .insert({ employee_id: employeeId, date, group_id: groupId, day_part: toDayPartColumn(dayParts) });
  if (inserted.error) done(formData, 'inval-mislukt');
  revalidatePath('/', 'layout');
  done(formData, 'ingezet');
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
  await supabase
    .from('substitutions')
    .update({ status: 'not_needed', handled_at: new Date().toISOString() })
    .eq('id', id)
    .eq('status', 'active');
  revalidatePath('/', 'layout');
  done(formData, 'ingetrokken');
}

/** Invallen die niet meer kloppen bijwerken, na een klik op het overzicht. */
export async function applyWarnings(formData: FormData): Promise<void> {
  const { supabase } = await requireAdmin();
  const today = todayInAmsterdam(new Date());
  const window = planningWindow(today, (await loadSettings(supabase)).lookaheadWeeks);
  const snapshot = await loadPlanningSnapshot(supabase, window);
  const changes = reviewSubstitutions(snapshot, eachDay(window.from, window.to), today);
  if (changes.length > 0) {
    const result = await supabase.rpc('apply_substitution_review', {
      changes: changes.map((change) => ({ id: change.substitutionId, status: change.status })) as unknown as Json,
    });
    if (result.error) done(formData, 'bijwerken-mislukt');
  }
  revalidatePath('/', 'layout');
  done(formData, 'bijgewerkt');
}
