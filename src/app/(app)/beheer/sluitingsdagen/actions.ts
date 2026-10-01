'use server';

import { revalidatePath } from 'next/cache';
import { holidayOverrides } from '@/lib/admin/closures';
import { dbErrorMessage } from '@/lib/admin/errors';
import { parseClosureForm, type ActionState } from '@/lib/admin/forms';
import { requireAdmin } from '@/lib/auth/session';
import { loadGroups } from '@/lib/db/queries';
import { isIsoDate, yearOf } from '@/lib/engine/dates';
import { dutchHolidays } from '@/lib/engine/holidays';

/** Per feestdag: welke groepen zijn dicht? Slaat alleen de afwijkingen op. */
export async function saveHoliday(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase } = await requireAdmin();
  const date = String(formData.get('date') ?? '');
  if (!isIsoDate(date) || !dutchHolidays(yearOf(date)).some((holiday) => holiday.date === date)) {
    return { error: 'Dit is geen feestdag.' };
  }
  const groups = await loadGroups(supabase);
  const closed = formData.getAll('closed').filter((value): value is string => typeof value === 'string');
  const rows = holidayOverrides(
    date,
    groups.map((group) => group.id),
    closed,
  );

  const removed = await supabase.from('closure_days').delete().eq('date', date);
  if (removed.error) return { error: dbErrorMessage(removed.error) };
  if (rows.length > 0) {
    const inserted = await supabase
      .from('closure_days')
      .insert(rows.map((row) => ({ date: row.date, group_id: row.groupId, is_closed: row.isClosed, label: row.label })));
    if (inserted.error) return { error: dbErrorMessage(inserted.error) };
  }
  revalidatePath('/', 'layout');
  return { ok: true, message: 'Opgeslagen.' };
}

/** Een extra sluitingsdag, voor alle groepen of voor één groep. */
export async function addClosure(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase } = await requireAdmin();
  const parsed = parseClosureForm(formData);
  if (!parsed.ok) return parsed.state;
  const { date, groupId, label } = parsed.data;
  if (dutchHolidays(yearOf(date)).some((holiday) => holiday.date === date)) {
    return { error: 'Dat is al een feestdag. Pas die hierboven aan.' };
  }
  const inserted = await supabase.from('closure_days').insert({ date, group_id: groupId, is_closed: true, label });
  if (inserted.error) return { error: dbErrorMessage(inserted.error) };
  revalidatePath('/', 'layout');
  return { ok: true, message: 'Sluitingsdag toegevoegd.' };
}

export async function deleteClosure(formData: FormData): Promise<void> {
  const { supabase } = await requireAdmin();
  await supabase.from('closure_days').delete().eq('id', String(formData.get('id') ?? ''));
  revalidatePath('/', 'layout');
}
