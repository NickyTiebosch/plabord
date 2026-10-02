'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { dbErrorMessage } from '@/lib/admin/errors';
import { parseDayRef, parseDayShiftForm, type ActionState } from '@/lib/admin/forms';
import { safeReturnPath, withNotice } from '@/lib/admin/planning';
import { requireAdmin, type Viewer } from '@/lib/auth/session';
import { loadGroups } from '@/lib/db/queries';
import { reviewAfterChange } from '@/lib/db/review';
import { todayInAmsterdam } from '@/lib/engine/dates';
import type { IsoDate } from '@/lib/engine/types';
import { mailAfterAction } from '@/lib/mail/after-action';

function returnPath(formData: FormData): string {
  return safeReturnPath(formData.get('terug'), '/beheer');
}

/**
 * Na een roosterwijziging: invallen op die dag(en) controleren (besluit V10), de mails versturen
 * (fase 3, V14: aan de medewerker zelf, en aan invallers van wie de inval vervalt), en dan terug
 * met een melding.
 */
async function finish(
  supabase: Viewer['supabase'],
  formData: FormData,
  employeeId: string,
  dates: IsoDate[],
  code: string,
): Promise<never> {
  const today = todayInAmsterdam(new Date());
  const review = await reviewAfterChange(supabase, dates, today);
  const mail = await mailAfterAction(supabase, [{ employeeId, kind: 'day_changed', dates }, ...review.notices]);
  revalidatePath('/', 'layout');
  redirect(
    withNotice(returnPath(formData), review.error ? 'controle-mislukt' : review.changes.length > 0 ? 'invallen-vervallen' : code, mail),
  );
}

async function groupExists(supabase: Viewer['supabase'], groupId: string): Promise<boolean> {
  return (await loadGroups(supabase)).some((group) => group.id === groupId);
}

/** Geen dienst deze dag. De vaste dienst blijft verder gewoon staan. */
export async function setDayOff(formData: FormData): Promise<void> {
  const { supabase } = await requireAdmin();
  const parsed = parseDayRef(formData);
  if (!parsed.ok) redirect(withNotice(returnPath(formData), 'wijziging-mislukt'));
  const { employeeId, date } = parsed.data;
  const saved = await supabase.rpc('set_shift_override', {
    p_employee_id: employeeId,
    p_date: date,
    p_kind: 'off',
    p_group_id: null,
    p_role: null,
    p_start_time: null,
    p_end_time: null,
  });
  if (saved.error) redirect(withNotice(returnPath(formData), 'wijziging-mislukt'));
  await finish(supabase, formData, employeeId, [date], 'gewijzigd');
}

/** Een andere dienst deze dag: andere groep, rol of tijden. Ook om een dienst toe te voegen. */
export async function setDayShift(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase } = await requireAdmin();
  const parsed = parseDayShiftForm(formData);
  if (!parsed.ok) return parsed.state;
  const input = parsed.data;
  if (!(await groupExists(supabase, input.groupId))) return { fieldErrors: { groupId: 'Kies een groep.' }, error: 'Kies een groep.' };
  const saved = await supabase.rpc('set_shift_override', {
    p_employee_id: input.employeeId,
    p_date: input.date,
    p_kind: 'shift',
    p_group_id: input.groupId,
    p_role: input.role,
    p_start_time: input.startTime,
    p_end_time: input.endTime,
  });
  if (saved.error) return { error: dbErrorMessage(saved.error) };
  return finish(supabase, formData, input.employeeId, [input.date], 'gewijzigd');
}

/** Verplaatsen naar een andere dag (besluit V6): geen dienst op de oude dag, een dienst op de nieuwe. */
export async function moveDayShift(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase } = await requireAdmin();
  const from = parseDayRef(formData);
  if (!from.ok) return from.state;
  const parsed = parseDayShiftForm(formData, 'to');
  if (!parsed.ok) {
    const fieldErrors = Object.fromEntries(
      Object.entries(parsed.state.fieldErrors ?? {}).map(([key, value]) => [key === 'date' ? 'to' : key, value]),
    );
    return { ...parsed.state, fieldErrors };
  }
  const input = parsed.data;
  if (input.date === from.data.date) return { error: 'Kies een andere dag.', fieldErrors: { to: 'Kies een andere dag.' } };
  if (!(await groupExists(supabase, input.groupId))) return { fieldErrors: { groupId: 'Kies een groep.' }, error: 'Kies een groep.' };
  const saved = await supabase.rpc('move_shift', {
    p_employee_id: input.employeeId,
    p_from: from.data.date,
    p_to: input.date,
    p_group_id: input.groupId,
    p_role: input.role,
    p_start_time: input.startTime,
    p_end_time: input.endTime,
  });
  if (saved.error) return { error: dbErrorMessage(saved.error) };
  return finish(supabase, formData, input.employeeId, [from.data.date, input.date], 'verplaatst');
}

/** Terug naar de vaste dienst: de wijziging voor die dag vervalt. Het logboek bewaart wat er was. */
export async function clearDayChange(formData: FormData): Promise<void> {
  const { supabase } = await requireAdmin();
  const parsed = parseDayRef(formData);
  if (!parsed.ok) redirect(withNotice(returnPath(formData), 'wijziging-mislukt'));
  const { employeeId, date } = parsed.data;
  const removed = await supabase.from('shift_overrides').delete().eq('employee_id', employeeId).eq('date', date);
  if (removed.error) redirect(withNotice(returnPath(formData), 'wijziging-mislukt'));
  await finish(supabase, formData, employeeId, [date], 'hersteld');
}
