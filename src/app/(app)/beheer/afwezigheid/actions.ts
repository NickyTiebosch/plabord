'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { dbErrorMessage } from '@/lib/admin/errors';
import { isUuid, parseAbsenceForm, type ActionState } from '@/lib/admin/forms';
import { impactLines, reviewSummary, withNotice } from '@/lib/admin/planning';
import { requireAdmin } from '@/lib/auth/session';
import { mapAbsence } from '@/lib/db/mappers';
import { loadPlanningSnapshot } from '@/lib/db/queries';
import { reviewAfterChange } from '@/lib/db/review';
import { todayInAmsterdam } from '@/lib/engine/dates';
import { formatDateRange } from '@/lib/engine/format';
import { absenceImpact, changedDates } from '@/lib/engine/impact';
import type { Absence } from '@/lib/engine/types';
import { mailAfterAction } from '@/lib/mail/after-action';
import { MAIL_OUTCOME_MESSAGES } from '@/lib/mail/outcome';

/** De melding na het opslaan, met de uitkomst van de controle op invallen. */
function noticeCode(review: { changes: unknown[]; error: string | null }, fallback: string): string {
  if (review.error) return 'controle-mislukt';
  return review.changes.length > 0 ? 'invallen-vervallen' : fallback;
}

/**
 * Nieuwe afwezigheid opslaan, of een bestaande wijzigen (met veld "id").
 * Eerst de impactcheck (fase 2): zakt er een dagdeel onder de norm of vervalt er een inval, dan
 * ziet de beheerder dat eerst. "Toch opslaan" stuurt de sleutel van precies deze invoer mee.
 */
export async function saveAbsence(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase } = await requireAdmin();
  const parsed = parseAbsenceForm(formData);
  if (!parsed.ok) return parsed.state;
  const input = parsed.data;
  const id = String(formData.get('id') ?? '');
  if (id && !isUuid(id)) return { error: 'Deze afwezigheid bestaat niet meer.' };
  const today = todayInAmsterdam(new Date());

  let previous: Absence | null = null;
  if (id) {
    const current = await supabase.from('absences').select('*').eq('id', id).maybeSingle();
    if (!current.data) return { error: 'Deze afwezigheid bestaat niet meer.' };
    previous = mapAbsence(current.data);
  }
  const next: Absence = {
    id: id || 'nieuw',
    employeeId: input.employeeId,
    startDate: input.startDate,
    endDate: input.endDate,
    dayPart: input.dayPart,
    status: input.status,
    updatedAt: new Date().toISOString(),
  };
  const dates = changedDates([previous, next], today);
  const token = [id, input.employeeId, input.startDate, input.endDate, input.dayPart, input.status].join('|');
  const first = dates[0];
  const last = dates.at(-1);
  if (formData.get('bevestigd') !== token && first && last) {
    const snapshot = await loadPlanningSnapshot(supabase, { from: first, to: last });
    const impact = absenceImpact(snapshot, { previous, next }, today);
    if (impact.parts.length > 0 || impact.changes.length > 0) {
      const names = new Map(snapshot.employees.map((employee) => [employee.id, employee.name]));
      const groupNames = new Map(snapshot.groups.map((group) => [group.id, group.name]));
      return { confirm: { token, lines: impactLines(impact, names, groupNames) } };
    }
  }

  const values = {
    employee_id: input.employeeId,
    start_date: input.startDate,
    end_date: input.endDate,
    day_part: input.dayPart,
    status: input.status,
  };

  const saved = id
    ? await supabase.from('absences').update(values).eq('id', id).select('id').maybeSingle()
    : await supabase.from('absences').insert(values).select('id').single();
  if (saved.error) return { error: dbErrorMessage(saved.error) };
  if (!saved.data) return { error: 'Deze afwezigheid bestaat niet meer.' };

  // Overlap mag, maar we zeggen het wel.
  const overlapping = await supabase
    .from('absences')
    .select('id, start_date, end_date')
    .eq('employee_id', input.employeeId)
    .lte('start_date', input.endDate)
    .gte('end_date', input.startDate)
    .neq('id', saved.data.id);
  const other = overlapping.data?.[0];
  // Achterhaalde invallen (besluit V10): niet meer nodig of opnieuw regelen. De invallers krijgen
  // een mail (fase 3, V14); wie afwezig is zelf niet: dat vraag je aan in MyHR.
  const review = await reviewAfterChange(supabase, dates, today);
  const mail = await mailAfterAction(supabase, review.notices);
  revalidatePath('/', 'layout');

  if (id) redirect(withNotice('/beheer/afwezigheid', noticeCode(review, 'opgeslagen'), mail));
  const notes = [
    other ? `Let op: dit overlapt met een andere afwezigheid (${formatDateRange(other.start_date, other.end_date)}).` : null,
    review.error ?? (reviewSummary(review.changes) || null),
    mail ? MAIL_OUTCOME_MESSAGES[mail].text : null,
  ].filter(Boolean);
  return { ok: true, message: notes.length > 0 ? `Opgeslagen. ${notes.join(' ')}` : 'Opgeslagen.' };
}

export async function approveAbsence(formData: FormData): Promise<void> {
  const { supabase } = await requireAdmin();
  const id = String(formData.get('id') ?? '');
  await supabase.from('absences').update({ status: 'approved' }).eq('id', id).eq('status', 'requested');
  revalidatePath('/', 'layout');
}

export async function deleteAbsence(formData: FormData): Promise<void> {
  const { supabase } = await requireAdmin();
  const id = String(formData.get('id') ?? '');
  if (!isUuid(id)) redirect('/beheer/afwezigheid');
  const current = await supabase.from('absences').select('start_date, end_date').eq('id', id).maybeSingle();
  await supabase.from('absences').delete().eq('id', id);
  // Een verwijderde afwezigheid kan een inval overbodig maken (besluit V10).
  const today = todayInAmsterdam(new Date());
  const range = current.data ? { startDate: current.data.start_date, endDate: current.data.end_date } : null;
  const review = await reviewAfterChange(supabase, changedDates([range], today), today);
  const mail = await mailAfterAction(supabase, review.notices);
  revalidatePath('/', 'layout');
  const code = noticeCode(review, 'verwijderd');
  if (formData.get('terug') === 'lijst' || code !== 'verwijderd' || mail) redirect(withNotice('/beheer/afwezigheid', code, mail));
}
