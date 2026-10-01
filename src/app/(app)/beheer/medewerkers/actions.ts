'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { changeAccountEmail, ensureAccount, setAccountBlocked } from '@/lib/admin/accounts';
import { dbErrorMessage } from '@/lib/admin/errors';
import { parseEmployeeForm, parseShiftForm, type ActionState, type EmployeeInput } from '@/lib/admin/forms';
import { planShiftEnd, planShiftFrom, type ShiftOp } from '@/lib/admin/shifts';
import { requireAdmin, type Viewer } from '@/lib/auth/session';
import { mapRecurringShift } from '@/lib/db/mappers';
import { isIsoDate } from '@/lib/engine/dates';
import type { ShiftWeekday } from '@/lib/engine/types';

type Supabase = Viewer['supabase'];

async function emailTakenByOther(supabase: Supabase, email: string, employeeId: string | null): Promise<boolean> {
  const { data } = await supabase.from('employee_accounts').select('employee_id').eq('email', email).maybeSingle();
  return Boolean(data && data.employee_id !== employeeId);
}

async function syncCounterGroups(supabase: Supabase, employeeId: string, groupIds: readonly string[]): Promise<string | null> {
  const current = await supabase.from('counter_eligibility').select('group_id').eq('employee_id', employeeId);
  if (current.error) return dbErrorMessage(current.error);
  const existing = new Set((current.data ?? []).map((row) => row.group_id));
  const wanted = new Set(groupIds);
  const toRemove = [...existing].filter((groupId) => !wanted.has(groupId));
  const toAdd = [...wanted].filter((groupId) => !existing.has(groupId));
  if (toRemove.length > 0) {
    const removed = await supabase.from('counter_eligibility').delete().eq('employee_id', employeeId).in('group_id', toRemove);
    if (removed.error) return dbErrorMessage(removed.error);
  }
  if (toAdd.length > 0) {
    const added = await supabase.from('counter_eligibility').insert(toAdd.map((groupId) => ({ employee_id: employeeId, group_id: groupId })));
    if (added.error) return dbErrorMessage(added.error);
  }
  return null;
}

function employeeValues(input: EmployeeInput) {
  return {
    name: input.name,
    group_id: input.groupId,
    default_role: input.defaultRole,
    is_admin: input.isAdmin,
    is_active: input.isActive,
  };
}

export async function createEmployee(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase } = await requireAdmin();
  const parsed = parseEmployeeForm(formData);
  if (!parsed.ok) return parsed.state;
  const input = parsed.data;
  if (input.email && (await emailTakenByOther(supabase, input.email, null))) {
    return { error: 'Dit e-mailadres hoort al bij een andere medewerker.', fieldErrors: { email: 'Al in gebruik.' } };
  }

  const created = await supabase.from('employees').insert(employeeValues(input)).select('id').single();
  if (created.error) return { error: dbErrorMessage(created.error) };
  const id = created.data.id;

  const counterError = await syncCounterGroups(supabase, id, input.counterGroupIds);
  let melding = counterError ? 'deels' : 'aangemaakt';
  if (input.email) {
    const account = await supabase.from('employee_accounts').insert({ employee_id: id, email: input.email });
    if (account.error) melding = 'deels';
    else if (!(await ensureAccount(id, input.email)).ok) melding = 'account-mislukt';
  }
  revalidatePath('/', 'layout');
  redirect(`/beheer/medewerkers/${id}?melding=${melding}`);
}

export async function updateEmployee(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const viewer = await requireAdmin();
  const { supabase } = viewer;
  const id = String(formData.get('id') ?? '');
  const parsed = parseEmployeeForm(formData);
  if (!parsed.ok) return parsed.state;
  const input = parsed.data;

  if (id === viewer.employeeId && !input.isActive) return { error: 'Je kunt jezelf niet op inactief zetten.' };
  if (id === viewer.employeeId && !input.isAdmin) {
    return { error: 'Je kunt je eigen beheerdersrechten niet uitzetten. Laat een andere beheerder dat doen.' };
  }

  const [before, account] = await Promise.all([
    supabase.from('employees').select('is_active').eq('id', id).maybeSingle(),
    supabase.from('employee_accounts').select('email, user_id').eq('employee_id', id).maybeSingle(),
  ]);
  if (!before.data) return { error: 'Deze medewerker bestaat niet meer.' };
  if (input.email && input.email !== account.data?.email && (await emailTakenByOther(supabase, input.email, id))) {
    return { error: 'Dit e-mailadres hoort al bij een andere medewerker.', fieldErrors: { email: 'Al in gebruik.' } };
  }

  const updated = await supabase.from('employees').update(employeeValues(input)).eq('id', id);
  if (updated.error) return { error: dbErrorMessage(updated.error) };
  const counterError = await syncCounterGroups(supabase, id, input.counterGroupIds);
  if (counterError) return { error: counterError };

  const warnings: string[] = [];
  const userId = account.data?.user_id ?? null;

  // E-mailadres: toevoegen, wijzigen of weghalen.
  const oldEmail = account.data?.email ?? null;
  if (input.email !== oldEmail) {
    if (!input.email) {
      if (userId) {
        const blocked = await setAccountBlocked(userId, true);
        if (!blocked.ok) warnings.push(blocked.error);
      }
      const removed = await supabase.from('employee_accounts').delete().eq('employee_id', id);
      if (removed.error) return { error: dbErrorMessage(removed.error) };
    } else if (!account.data) {
      const inserted = await supabase.from('employee_accounts').insert({ employee_id: id, email: input.email });
      if (inserted.error) return { error: dbErrorMessage(inserted.error) };
      const created = await ensureAccount(id, input.email);
      if (!created.ok) warnings.push(created.error);
    } else {
      if (userId) {
        const changed = await changeAccountEmail(userId, input.email);
        if (!changed.ok) return { error: changed.error };
      }
      const saved = await supabase.from('employee_accounts').update({ email: input.email }).eq('employee_id', id);
      if (saved.error) return { error: dbErrorMessage(saved.error) };
      if (!userId) {
        const created = await ensureAccount(id, input.email);
        if (!created.ok) warnings.push(created.error);
      }
    }
  }

  // Inactief: inloggen blokkeren. Weer actief: vrijgeven.
  if (userId && input.email && before.data.is_active !== input.isActive) {
    const blocked = await setAccountBlocked(userId, !input.isActive);
    if (!blocked.ok) warnings.push(blocked.error);
  }

  revalidatePath('/', 'layout');
  return { ok: true, message: warnings.length > 0 ? `Opgeslagen, maar: ${warnings.join(' ')}` : 'Opgeslagen.' };
}

export async function retryAccount(formData: FormData): Promise<void> {
  const { supabase } = await requireAdmin();
  const id = String(formData.get('id') ?? '');
  const account = await supabase.from('employee_accounts').select('email, user_id').eq('employee_id', id).maybeSingle();
  let melding = 'account-mislukt';
  if (account.data && !account.data.user_id) {
    melding = (await ensureAccount(id, account.data.email)).ok ? 'account-aangemaakt' : 'account-mislukt';
  }
  revalidatePath('/beheer/medewerkers', 'layout');
  redirect(`/beheer/medewerkers/${id}?melding=${melding}`);
}

async function runShiftOps(supabase: Supabase, employeeId: string, ops: readonly ShiftOp[]): Promise<string | null> {
  for (const op of ops) {
    const result =
      op.type === 'close'
        ? await supabase.from('recurring_shifts').update({ valid_to: op.validTo }).eq('id', op.id).eq('employee_id', employeeId)
        : op.type === 'update'
          ? await supabase
              .from('recurring_shifts')
              .update({
                group_id: op.values.groupId,
                role: op.values.role,
                start_time: op.values.startTime,
                end_time: op.values.endTime,
              })
              .eq('id', op.id)
              .eq('employee_id', employeeId)
          : await supabase.from('recurring_shifts').insert({
              employee_id: employeeId,
              weekday: op.values.weekday,
              group_id: op.values.groupId,
              role: op.values.role,
              start_time: op.values.startTime,
              end_time: op.values.endTime,
              valid_from: op.values.validFrom,
              valid_to: op.values.validTo,
            });
    if (result.error) return dbErrorMessage(result.error);
  }
  return null;
}

async function loadShifts(supabase: Supabase, employeeId: string) {
  const { data, error } = await supabase.from('recurring_shifts').select('*').eq('employee_id', employeeId);
  if (error) throw new Error(dbErrorMessage(error, 'De vaste diensten konden niet worden geladen.'));
  return (data ?? []).map(mapRecurringShift);
}

/** Vaste dienst op een weekdag vanaf een datum. Het verleden blijft zoals het was. */
export async function saveShiftFrom(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase } = await requireAdmin();
  const employeeId = String(formData.get('employeeId') ?? '');
  const parsed = parseShiftForm(formData);
  if (!parsed.ok) return parsed.state;
  const plan = planShiftFrom(await loadShifts(supabase, employeeId), parsed.data);
  if (!plan.ok) return { error: plan.error };
  const error = await runShiftOps(supabase, employeeId, plan.ops);
  if (error) return { error };
  revalidatePath('/', 'layout');
  return { ok: true, message: 'Vaste dienst opgeslagen.' };
}

/** Een vaste dienst laten stoppen na een datum. */
export async function endShift(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase } = await requireAdmin();
  const employeeId = String(formData.get('employeeId') ?? '');
  const weekday = Number(formData.get('weekday'));
  const lastDay = String(formData.get('lastDay') ?? '');
  if (!Number.isInteger(weekday) || weekday < 1 || weekday > 6) return { fieldErrors: { weekday: 'Kies een dag.' } };
  if (!isIsoDate(lastDay)) return { fieldErrors: { lastDay: 'Vul een geldige datum in.' } };
  const plan = planShiftEnd(await loadShifts(supabase, employeeId), weekday as ShiftWeekday, lastDay);
  if (!plan.ok) return { error: plan.error };
  const error = await runShiftOps(supabase, employeeId, plan.ops);
  if (error) return { error };
  revalidatePath('/', 'layout');
  return { ok: true, message: 'De vaste dienst stopt na die datum.' };
}

/** Een vaste dienst verwijderen die per vergissing is ingevoerd. Staat in het logboek. */
export async function deleteShift(formData: FormData): Promise<void> {
  const { supabase } = await requireAdmin();
  const id = String(formData.get('id') ?? '');
  const employeeId = String(formData.get('employeeId') ?? '');
  await supabase.from('recurring_shifts').delete().eq('id', id).eq('employee_id', employeeId);
  revalidatePath('/', 'layout');
  redirect(`/beheer/medewerkers/${employeeId}?melding=verwijderd`);
}
