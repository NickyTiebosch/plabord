'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { dbErrorMessage } from '@/lib/admin/errors';
import { parseAbsenceForm, type ActionState } from '@/lib/admin/forms';
import { requireAdmin } from '@/lib/auth/session';
import { formatDateRange } from '@/lib/engine/format';

/** Nieuwe afwezigheid opslaan, of een bestaande wijzigen (met veld "id"). */
export async function saveAbsence(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase } = await requireAdmin();
  const parsed = parseAbsenceForm(formData);
  if (!parsed.ok) return parsed.state;
  const input = parsed.data;
  const id = String(formData.get('id') ?? '');
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
  revalidatePath('/', 'layout');

  if (id) redirect('/beheer/afwezigheid?melding=opgeslagen');
  return {
    ok: true,
    message: other
      ? `Opgeslagen. Let op: dit overlapt met een andere afwezigheid (${formatDateRange(other.start_date, other.end_date)}).`
      : 'Opgeslagen.',
  };
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
  await supabase.from('absences').delete().eq('id', id);
  revalidatePath('/', 'layout');
  if (formData.get('terug') === 'lijst') redirect('/beheer/afwezigheid?melding=verwijderd');
}
